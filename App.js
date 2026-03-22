import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StatusBar, Platform, SafeAreaView, StyleSheet, Image, Vibration,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';

// ─── Assets (all bundled — no missing file errors) ───────────────────
const LOGO     = require('./assets/logo.png');
const ALARM_MP3 = require('./assets/alarm.mp3');

// ─── Notification handler: show even when app is in foreground ───────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Mock data ────────────────────────────────────────────────────────
const MOCK_HISTORY = [
  { id: 1, msg: 'Sensor calibration complete', type: 'info', time: '09:38 AM' },
  { id: 2, msg: 'Cylinder level check: 65%',   type: 'info', time: '09:40 AM' },
  { id: 3, msg: 'System started — all clear',   type: 'safe', time: '09:41 AM' },
];

function getNow() {
  const d = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
}

// ─── Colors ───────────────────────────────────────────────────────────
const C = {
  primary:   '#1565C0',
  primaryBg: '#E3F2FD',
  safe:      '#2E7D32',
  safeBg:    '#E8F5E9',
  safeDot:   '#43A047',
  danger:    '#C62828',
  dangerBg:  '#FFEBEE',
  dangerDot: '#E53935',
  surface:   '#FFFFFF',
  bg:        '#F0F4FC',
  text:      '#1A2340',
  muted:     '#7B8BB2',
  border:    '#E0E8F5',
  dark:      '#0D1B3E',
  darkAccent:'#8A9AB8',
};

// ─── Notification helpers ─────────────────────────────────────────────
async function registerForNotifications() {
  if (Platform.OS === 'android') {
    // High-priority channel — uses notification-icon.png (your logo silhouette)
    // set in app.json plugins → expo-notifications → icon
    await Notifications.setNotificationChannelAsync('gas-alert', {
      name:             'Ignis Secura — Gas Leak Alerts',
      description:      'Critical alerts when a gas leak is detected.',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      lightColor:       '#FF5722',   // matches logo orange
      sound:            'default',
      enableVibrate:    true,
      showBadge:        true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (Device.isDevice) {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Enable notifications in Settings to receive gas leak alerts!');
    }
  }
}

async function fireLeakNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 Ignis Secura — GAS LEAK DETECTED',
      body:   '⚠ Abnormal gas detected! Ventilate the area and close the valve immediately.',
      sound:  'default',
      badge:  1,
      data:   { type: 'gas_leak' },
      ...(Platform.OS === 'android' && {
        channelId:  'gas-alert',
        color:      '#FF5722',
        priority:   'max',
        sticky:     true,
        // Small status-bar icon = white silhouette (Android OS forces this — cannot be colored)
        // Large notification card icon = your full colored logo (set via app.json largeIcon)
        largeIcon:  'logo',   // resolves to assets/logo.png via expo-notifications
      }),
    },
    trigger: null,
  });
}

async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

// ─── Components ───────────────────────────────────────────────────────

function AlertBanner({ leakActive }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const blinkLoop = useRef(null);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: leakActive ? 1.01 : 1, useNativeDriver: true, tension: 100 }).start();
    if (leakActive) {
      blinkLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.15, duration: 500, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      blinkLoop.current.start();
    } else {
      blinkLoop.current?.stop();
      Animated.timing(blinkAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => blinkLoop.current?.stop();
  }, [leakActive]);

  return (
    <Animated.View style={[styles.alertBanner, leakActive ? styles.alertDanger : styles.alertSafe, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.Text style={[styles.alertIcon, { opacity: leakActive ? blinkAnim : 1 }]}>
        {leakActive ? '⚠️' : '✅'}
      </Animated.Text>
      <Text style={[styles.alertText, leakActive ? styles.alertTextDanger : styles.alertTextSafe]}>
        {leakActive ? 'Gas Leak Detected — Take Immediate Action!' : 'No Leak Detected — System Normal'}
      </Text>
    </Animated.View>
  );
}

function GasLevelCard({ level, leakActive }) {
  const barWidth = useRef(new Animated.Value(level)).current;
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue:  leakActive ? Math.max(level - 8, 0) : level,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [leakActive]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>CYLINDER LEVEL</Text>
        <View style={[styles.cardIconWrap, { backgroundColor: C.primaryBg }]}>
          <Text style={styles.cardIconText}>🛢</Text>
        </View>
      </View>
      <Text style={[styles.gasPercent, { color: leakActive ? C.danger : C.primary }]}>
        {leakActive ? `${Math.max(level - 8, 0)}%` : `${level}%`}
      </Text>
      <Text style={styles.gasSub}>Remaining gas in cylinder</Text>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, {
          width:           barWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: leakActive ? C.dangerDot : C.primary,
        }]} />
      </View>
      <View style={styles.progressLabels}>
        {['0%', '25%', '50%', '75%', '100%'].map(l => (
          <Text key={l} style={styles.progressLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

function StatRow({ leakActive }) {
  return (
    <View style={styles.statsRow}>
      {[
        { val: leakActive ? '31°C'    : '24°C',    lbl: 'Temperature', danger: leakActive },
        { val: leakActive ? '2.1 bar' : '1.2 bar', lbl: 'Pressure',    danger: leakActive },
        { val: leakActive ? '98.1%'   : '99.8%',   lbl: 'Uptime',      danger: false },
      ].map((s, i) => (
        <View key={i} style={[styles.statMini, s.danger && styles.statMiniDanger]}>
          <Text style={[styles.statVal, s.danger && styles.statValDanger]}>{s.val}</Text>
          <Text style={styles.statLbl}>{s.lbl}</Text>
        </View>
      ))}
    </View>
  );
}

function SafetyStatusCard({ leakActive }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
    if (leakActive) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => pulseLoop.current?.stop();
  }, [leakActive]);

  const dotColor = leakActive ? C.dangerDot : C.safeDot;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>SAFETY STATUS</Text>
        <View style={[styles.cardIconWrap, { backgroundColor: leakActive ? C.dangerBg : C.safeBg }]}>
          <Text style={styles.cardIconText}>{leakActive ? '🔴' : '🟢'}</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={styles.dotWrap}>
          <Animated.View style={[styles.dotRing, { backgroundColor: dotColor + '33', transform: [{ scale: pulseAnim }] }]} />
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </View>
        <Text style={[styles.statusValue, leakActive ? styles.statusDanger : styles.statusSafe]}>
          {leakActive ? 'Gas Leak Detected' : 'Safe'}
        </Text>
      </View>
      <Text style={styles.statusDesc}>
        {leakActive
          ? 'Warning! Abnormal gas concentration detected. Ventilate the area and shut off the valve immediately.'
          : 'All sensors operating normally. No anomalies detected. Environment is safe.'}
      </Text>
    </View>
  );
}

function LeakToggleCard({ leakActive, onToggle }) {
  const thumbPos = useRef(new Animated.Value(leakActive ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(thumbPos, {
      toValue: leakActive ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 10,
    }).start();
  }, [leakActive]);

  return (
    <View style={styles.toggleCard}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleTitle}>Simulate Gas Leak</Text>
        <Text style={styles.toggleDesc}>
          {leakActive ? '🔴 Leak simulation is ACTIVE' : 'Tap to trigger a leak simulation'}
        </Text>
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <Animated.View style={[styles.toggleTrack, {
          backgroundColor: thumbPos.interpolate({ inputRange: [0, 1], outputRange: [C.muted, C.dangerDot] }),
        }]}>
          <Animated.View style={[styles.toggleThumb, {
            transform: [{ translateX: thumbPos.interpolate({ inputRange: [0, 1], outputRange: [2, 26] }) }],
          }]} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

function EventLogCard({ history }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>EVENT LOG</Text>
        <View style={[styles.cardIconWrap, { backgroundColor: C.primaryBg }]}>
          <Text style={styles.cardIconText}>📋</Text>
        </View>
      </View>
      {history.map((item, idx) => (
        <View key={item.id} style={[styles.historyItem, idx === history.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[styles.historyDot, {
            backgroundColor: item.type === 'danger' ? C.dangerDot : item.type === 'safe' ? C.safeDot : C.primary,
          }]} />
          <Text style={styles.historyMsg}>{item.msg}</Text>
          <Text style={styles.historyTime}>{item.time}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── In-App Notification Banner ──────────────────────────────────────
function InAppNotification({ visible, onDismiss }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,    duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.inNotifWrap, { transform: [{ translateY }], opacity }]}>
      <View style={styles.inNotifCard}>
        <Image source={LOGO} style={styles.inNotifLogo} resizeMode="contain" />
        <View style={styles.inNotifBody}>
          <Text style={styles.inNotifApp}>IGNIS SECURA</Text>
          <Text style={styles.inNotifMsg}>⚠ Gas Leak Detected!</Text>
          <Text style={styles.inNotifSub}>Ventilate area · Close valve immediately</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.inNotifClose}>
          <Text style={styles.inNotifCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────
export default function App() {
  const [leakActive, setLeakActive] = useState(false);
  const [history,    setHistory]    = useState(MOCK_HISTORY);
  const [liveTime,   setLiveTime]   = useState(getNow());
  const [showNotif,  setShowNotif]  = useState(false);
  const soundRef                    = useRef(null);
  const gasLevel                    = 65;

  // Live clock — ticks every second
  useEffect(() => {
    const tick = setInterval(() => setLiveTime(getNow()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    registerForNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);

  // ── Alarm: start looping sound + vibration ──────────────────────────
  const startAlarm = async () => {
    // Vibration pattern: buzz 400ms, pause 200ms, repeat
    Vibration.vibrate([0, 400, 200, 400, 200, 400, 200, 400], true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:  false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        ALARM_MP3,
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      // Sound failed (emulator / missing codec) — vibration still runs
      console.warn('Audio playback skipped:', e.message);
    }
  };

  const stopAlarm = async () => {
    Vibration.cancel();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
    }
  };

  // ── Toggle handler ────────────────────────────────────────────────────
  const toggleLeak = async () => {
    const next = !leakActive;
    setLeakActive(next);

    if (next) {
      await fireLeakNotification();
      await startAlarm();
      setShowNotif(true);
      setHistory(prev => [
        { id: Date.now(), msg: '⚠ Gas leak detected — alert triggered', type: 'danger', time: getNow() },
        ...prev.slice(0, 5),
      ]);
    } else {
      await stopAlarm();
      await clearBadge();
      setShowNotif(false);
      setHistory(prev => [
        { id: Date.now(), msg: '✅ Leak simulation ended — system safe', type: 'safe', time: getNow() },
        ...prev.slice(0, 5),
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* ── In-app notification banner (slides down on leak) ── */}
      <InAppNotification visible={showNotif} onDismiss={() => setShowNotif(false)} />

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.statusBarRow}>
          <Text style={styles.statusBarTime}>{liveTime}</Text>
          <Text style={styles.statusBarRight}>●●● WiFi 🔋</Text>
        </View>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.appTitle}>Ignis Secura</Text>
              <Text style={styles.appSubtitle}>Smart Gas Safety Monitor</Text>
            </View>
          </View>
          <View style={styles.headerIconWrap}>
            <Text style={styles.headerIcon}>🛡️</Text>
          </View>
        </View>
      </View>

      {/* ── Dashboard scroll ────────────────────────────────── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AlertBanner      leakActive={leakActive} />
        <GasLevelCard     level={gasLevel} leakActive={leakActive} />
        <StatRow          leakActive={leakActive} />
        <SafetyStatusCard leakActive={leakActive} />
        <LeakToggleCard   leakActive={leakActive} onToggle={toggleLeak} />
        <EventLogCard     history={history} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.primary },

  header:         { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20 },
  statusBarRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statusBarTime:  { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  statusBarRight: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo:           { width: 44, height: 44, borderRadius: 10 },
  appTitle:       { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  appSubtitle:    { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  headerIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIcon:     { fontSize: 22 },

  scroll:  { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },

  alertBanner:     { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 14, gap: 10 },
  alertSafe:       { backgroundColor: C.safeBg,   borderWidth: 1, borderColor: '#A5D6A7' },
  alertDanger:     { backgroundColor: C.dangerBg, borderWidth: 1, borderColor: '#EF9A9A' },
  alertIcon:       { fontSize: 18 },
  alertText:       { flex: 1, fontSize: 13, fontWeight: '600' },
  alertTextSafe:   { color: C.safe },
  alertTextDanger: { color: C.danger },

  card: { backgroundColor: C.surface, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: C.border, shadowColor: '#1565C0', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardLabel:    { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 15 },

  gasPercent:     { fontSize: 52, fontWeight: '700', lineHeight: 58 },
  gasSub:         { fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 14 },
  progressTrack:  { height: 10, backgroundColor: '#E3EAFF', borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  progressFill:   { height: '100%', borderRadius: 99 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { fontSize: 9, color: '#AABACF' },

  statsRow:       { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statMini:       { flex: 1, backgroundColor: '#F0F4FF', borderRadius: 14, padding: 12, alignItems: 'center' },
  statMiniDanger: { backgroundColor: '#FFF0F0' },
  statVal:        { fontSize: 15, fontWeight: '700', color: C.primary },
  statValDanger:  { color: C.danger },
  statLbl:        { fontSize: 10, color: C.muted, marginTop: 2 },

  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dotWrap:      { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dotRing:      { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  dot:          { width: 12, height: 12, borderRadius: 6 },
  statusValue:  { fontSize: 20, fontWeight: '700' },
  statusSafe:   { color: C.safe },
  statusDanger: { color: C.danger },
  statusDesc:   { fontSize: 13, color: C.muted, lineHeight: 19 },

  toggleCard:  { backgroundColor: C.surface, borderRadius: 20, padding: 18, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: C.border, shadowColor: '#1565C0', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  toggleInfo:  { flex: 1, marginRight: 16 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 3 },
  toggleDesc:  { fontSize: 12, color: C.muted },
  toggleTrack: { width: 54, height: 30, borderRadius: 99, justifyContent: 'center' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },

  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#F0F4FF', gap: 10 },
  historyDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  historyMsg:  { flex: 1, fontSize: 12, color: C.text },
  historyTime: { fontSize: 10, color: '#AABACF' },

  // in-app notification banner
  inNotifWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 8 : 12,
  },
  inNotifCard: {
    backgroundColor: C.dark, borderRadius: 18, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 10,
    borderWidth: 1, borderColor: '#FF572240',
  },
  inNotifLogo:      { width: 38, height: 38, borderRadius: 10 },
  inNotifBody:      { flex: 1 },
  inNotifApp:       { fontSize: 9, color: C.darkAccent, letterSpacing: 1.2, marginBottom: 2 },
  inNotifMsg:       { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  inNotifSub:       { fontSize: 10, color: C.darkAccent, marginTop: 2 },
  inNotifClose:     { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 6 },
  inNotifCloseText: { color: C.darkAccent, fontSize: 12 },
});
