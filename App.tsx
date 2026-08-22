import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, ImageBackground, Modal, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildHistory, CareActivity, CareEvent, CARE_ICONS, CARE_LABELS, Cat, CATS,
  Feeding, formatTime, latestCareFor, latestFor, millisecondsUntilNextReset,
  trackingDate, Meal, MEALS, MEAL_ICONS, MEAL_LABELS, PEOPLE, Person,
} from './src/domain';
import { PERSON_KEY, repository } from './src/repository';

type Tab = 'today' | 'history';

const CAT_AVATARS = {
  Angela: require('./assets/cats/angela-avatar.png'),
  Basta: require('./assets/cats/basta-avatar.png'),
} as const;
const HEADER_IMAGE = require('./assets/ui/cats-header.jpg');
const EVENING_POUCH = require('./assets/ui/evening-pouch.png');

function CatPairIcon() {
  return (
    <View style={styles.catPair} accessibilityLabel="Dwa koty">
      <Text style={styles.catPairItem}>🐈</Text>
      <Text style={styles.catPairItem}>🐈</Text>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><KotyApp /></SafeAreaProvider>;
}

function KotyApp() {
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<Person | null>(null);
  const [choosingPerson, setChoosingPerson] = useState(false);
  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState(() => trackingDate());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleReset = () => {
      timer = setTimeout(() => {
        setToday(trackingDate());
        scheduleReset();
      }, millisecondsUntilNextReset() + 250);
    };
    scheduleReset();
    return () => clearTimeout(timer);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextFeedings, nextCareEvents] = await Promise.all([
        repository.list(),
        repository.listCare(),
      ]);
      setFeedings(nextFeedings);
      setCareEvents(nextCareEvents);
    } catch (error) {
      Alert.alert('Nie udało się pobrać danych', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(PERSON_KEY).then((saved) => {
      if (saved && PEOPLE.includes(saved as Person)) setPerson(saved as Person);
      else setChoosingPerson(true);
    });
    void refresh();
    return repository.subscribe(() => { void refresh(); });
  }, [refresh]);

  const choosePerson = async (value: Person) => {
    await AsyncStorage.setItem(PERSON_KEY, value);
    setPerson(value);
    setChoosingPerson(false);
  };

  const save = async (cats: Cat[], meal: Meal, force = false) => {
    if (!person || saving) return;
    const duplicates = cats
      .map((cat) => latestFor(feedings, today, cat, meal))
      .filter((item): item is Feeding => Boolean(item));

    if (duplicates.length && !force) {
      const details = duplicates
        .map((item) => `${item.cat} dostała już ten posiłek o ${formatTime(item.fedAt)}. Karmi: ${item.fedBy}.`)
        .join('\n');
      Alert.alert(
        'Posiłek już zapisany',
        `${details}\n\nCzy na pewno chcesz zapisać kolejne karmienie?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Zapisz ponownie', style: 'destructive', onPress: () => { void save(cats, meal, true); } },
        ],
      );
      return;
    }

    try {
      setSaving(true);
      const added = await repository.add(cats, meal, person);
      setFeedings((current) => [...added, ...current]);
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Sprawdź połączenie.');
    } finally {
      setSaving(false);
    }
  };

  const saveCare = async (activity: CareActivity, cat: Cat | null, force = false) => {
    if (!person || saving) return;
    const previous = latestCareFor(careEvents, today, activity, cat);
    if (previous && !force) {
      const subject = cat ?? 'Kuweta';
      Alert.alert(
        'Czynność już zapisana',
        `${subject}: ${CARE_LABELS[activity].toLowerCase()} zapisano już o ${formatTime(previous.doneAt)} (${previous.doneBy}).\n\nCzy zapisać ponownie?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Zapisz ponownie', style: 'destructive', onPress: () => { void saveCare(activity, cat, true); } },
        ],
      );
      return;
    }
    try {
      setSaving(true);
      const added = await repository.addCare(activity, cat, person);
      setCareEvents((current) => [added, ...current]);
    } catch (error) {
      Alert.alert('Nie udało się zapisać', error instanceof Error ? error.message : 'Sprawdź połączenie.');
    } finally {
      setSaving(false);
    }
  };

  const history = useMemo(() => buildHistory(feedings, careEvents), [feedings, careEvents]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ImageBackground source={HEADER_IMAGE} resizeMode="cover" style={styles.headerBanner} imageStyle={styles.headerImage}>
        <View style={styles.headerScrim} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>KOTY</Text>
            <Text style={styles.title}>{tab === 'today' ? 'Dzisiaj' : 'Historia'}</Text>
          </View>
          <Pressable style={styles.personChip} onPress={() => setChoosingPerson(true)}>
            <Text style={styles.personChipText}>{person ?? 'Wybierz osobę'} ▾</Text>
          </Pressable>
        </View>
      </ImageBackground>

      {!repository.isOnline && (
        <View style={styles.offline}><Text style={styles.offlineText}>Tryb lokalny · skonfiguruj Supabase, aby współdzielić dane</Text></View>
      )}

      {loading ? <ActivityIndicator style={styles.loader} size="large" color="#CC5D35" /> : tab === 'today' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.legendRow}>
            <Text style={[styles.columnTitle, styles.catColumn]}>Kot</Text>
            {MEALS.map((meal) => <Text key={meal} style={styles.columnTitle}>{MEAL_LABELS[meal]}</Text>)}
          </View>
          {CATS.map((cat) => (
            <View key={cat} style={styles.catRow}>
              <View style={styles.catNameBox}>
                <View style={styles.avatarFrame}><Image source={CAT_AVATARS[cat]} style={styles.catAvatar} resizeMode="cover" /></View>
                <Text style={styles.catName}>{cat}</Text>
              </View>
              {MEALS.map((meal) => {
                const latest = latestFor(feedings, today, cat, meal);
                return (
                  <Pressable
                    accessibilityLabel={`${cat}, ${MEAL_LABELS[meal]}`}
                    key={meal}
                    disabled={saving}
                    onPress={() => void save([cat], meal)}
                    style={({ pressed }) => [styles.mealCell, latest && styles.mealCellDone, pressed && styles.pressed]}
                  >
                    {meal === 'evening'
                      ? <Image source={EVENING_POUCH} style={styles.mealPouchIcon} resizeMode="contain" />
                      : <Text style={styles.mealIcon}>{MEAL_ICONS[meal]}</Text>}
                    <Text style={[styles.statusText, latest && styles.statusTextDone]}>{latest ? `✓ ${formatTime(latest.fedAt)}` : 'Daj'}</Text>
                    {latest && <Text numberOfLines={1} style={styles.fedBy}>{latest.fedBy}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Text style={styles.sectionTitle}>Szybkie karmienie</Text>
          {MEALS.map((meal) => (
            <Pressable
              key={meal}
              disabled={saving}
              onPress={() => void save([...CATS], meal)}
              style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
            >
              <CatPairIcon />
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>Nakarmiono oba koty</Text>
                <Text style={styles.quickSubtitle}>{MEAL_LABELS[meal].toLowerCase()}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>Opieka</Text>
          {(['play', 'brushing'] as const).map((activity) => (
            <View key={activity} style={styles.careCard}>
              <View style={styles.careHeading}>
                <Text style={styles.careIcon}>{CARE_ICONS[activity]}</Text>
                <Text style={styles.careTitle}>{CARE_LABELS[activity]}</Text>
              </View>
              <View style={styles.careActions}>
                {CATS.map((cat) => {
                  const latest = latestCareFor(careEvents, today, activity, cat);
                  return (
                    <Pressable
                      key={cat}
                      disabled={saving}
                      onPress={() => void saveCare(activity, cat)}
                      style={({ pressed }) => [styles.careButton, latest && styles.careButtonDone, pressed && styles.pressed]}
                    >
                      <Text style={[styles.careButtonName, latest && styles.statusTextDone]}>{latest ? '✓ ' : ''}{cat}</Text>
                      <Text style={styles.careButtonMeta}>{latest ? `${formatTime(latest.doneAt)} · ${latest.doneBy}` : 'Zaznacz'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {(() => {
            const latest = latestCareFor(careEvents, today, 'litter', null);
            return (
              <Pressable
                disabled={saving}
                onPress={() => void saveCare('litter', null)}
                style={({ pressed }) => [styles.litterButton, latest && styles.careButtonDone, pressed && styles.pressed]}
              >
                <Text style={styles.careIcon}>{CARE_ICONS.litter}</Text>
                <View style={styles.quickCopy}>
                  <Text style={[styles.quickTitle, latest && styles.statusTextDone]}>{latest ? '✓ ' : ''}Kuweta</Text>
                  <Text style={styles.quickSubtitle}>{latest ? `${formatTime(latest.doneAt)} · ${latest.doneBy}` : 'Jeden przycisk dla obu kotów'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })()}
        </ScrollView>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={<Text style={styles.empty}>Brak zapisanych czynności.</Text>}
          renderItem={({ item }) => {
            return (
              <View style={styles.historyCard}>
                <Text style={styles.historyIcon}>{item.icon}</Text>
                <Text style={styles.historyTime}>{formatTime(item.at)}</Text>
                <View style={styles.historyBody}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyMeta}>{item.localDate} · {item.person}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable style={[styles.tab, tab === 'today' && styles.tabActive]} onPress={() => setTab('today')}><Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>Dzisiaj</Text></Pressable>
        <Pressable style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}><Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Historia</Text></Pressable>
      </View>

      <Modal visible={choosingPerson} transparent animationType="fade" onRequestClose={() => person && setChoosingPerson(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Kto korzysta z telefonu?</Text>
          <Text style={styles.modalText}>Wybór zapamiętamy na tym urządzeniu.</Text>
          {PEOPLE.map((item) => (
            <Pressable key={item} onPress={() => void choosePerson(item)} style={({ pressed }) => [styles.personButton, pressed && styles.pressed]}>
              <Text style={styles.personButtonText}>{item}</Text>
            </Pressable>
          ))}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const colors = { ink: '#2E2925', muted: '#766D65', paper: '#FFF9F2', card: '#FFFFFF', accent: '#CC5D35', green: '#2F7D59', paleGreen: '#E4F3EA', line: '#E9DED2' };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  headerBanner: { minHeight: 132, marginHorizontal: 12, marginTop: 8, marginBottom: 10, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  headerImage: { borderRadius: 22 },
  headerScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(28, 20, 15, 0.40)' },
  header: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: '#FFF8EE', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
  title: { fontSize: 31, fontWeight: '800', color: '#FFFFFF', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.40)', textShadowRadius: 6 },
  personChip: { backgroundColor: 'rgba(255, 249, 242, 0.90)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18 },
  personChipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  offline: { marginHorizontal: 20, marginBottom: 8, padding: 9, borderRadius: 10, backgroundColor: '#FFF0CF' },
  offlineText: { fontSize: 11, color: '#725513', textAlign: 'center' },
  loader: { flex: 1 },
  content: { padding: 16, paddingBottom: 26 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  columnTitle: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: colors.muted },
  catColumn: { flex: 0.95, textAlign: 'left', paddingLeft: 5 },
  catRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  catNameBox: { flex: 0.95, minHeight: 91, backgroundColor: '#F5E8DB', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarFrame: { width: 45, height: 45, borderRadius: 23, overflow: 'hidden', backgroundColor: '#E7D6C5', borderWidth: 2, borderColor: '#FFFFFF' },
  catAvatar: { width: '100%', height: '100%' }, catName: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 3 },
  mealCell: { flex: 1, minHeight: 91, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 4 },
  mealCellDone: { backgroundColor: colors.paleGreen, borderColor: '#B9DDC8' },
  mealIcon: { fontSize: 23 },
  mealPouchIcon: { width: 29, height: 29 },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 3 },
  statusTextDone: { color: colors.green }, fedBy: { fontSize: 9, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 20, marginBottom: 10 },
  quickButton: { minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 17, marginBottom: 9, paddingHorizontal: 15 },
  catPair: { width: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  catPairItem: { fontSize: 19 }, quickCopy: { flex: 1, marginLeft: 8 },
  quickTitle: { fontSize: 15, fontWeight: '800', color: colors.ink }, quickSubtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  chevron: { fontSize: 28, color: colors.accent }, pressed: { opacity: 0.65, transform: [{ scale: 0.99 }] },
  careCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 13, marginBottom: 9 },
  careHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  careIcon: { fontSize: 22 }, careTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginLeft: 9 },
  careActions: { flexDirection: 'row', gap: 8 },
  careButton: { flex: 1, minHeight: 58, borderRadius: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  careButtonDone: { backgroundColor: colors.paleGreen, borderColor: '#B9DDC8' },
  careButtonName: { fontSize: 14, fontWeight: '800', color: colors.ink }, careButtonMeta: { fontSize: 9, color: colors.muted, marginTop: 3 },
  litterButton: { minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 17, paddingHorizontal: 15 },
  historyList: { padding: 16, paddingBottom: 30 },
  historyCard: { flexDirection: 'row', padding: 15, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 9 },
  historyIcon: { width: 31, fontSize: 18 }, historyTime: { width: 52, fontSize: 17, fontWeight: '800', color: colors.accent }, historyBody: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink }, historyMeta: { fontSize: 12, color: colors.muted, marginTop: 4 }, empty: { textAlign: 'center', color: colors.muted, marginTop: 50 },
  tabs: { flexDirection: 'row', padding: 8, gap: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }, tabActive: { backgroundColor: '#F5E8DB' },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.muted }, tabTextActive: { color: colors.accent },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(46,41,37,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.paper, padding: 22, borderRadius: 24 }, modalTitle: { fontSize: 23, fontWeight: '800', color: colors.ink },
  modalText: { fontSize: 13, color: colors.muted, marginTop: 5, marginBottom: 17 },
  personButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 8 },
  personButtonText: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
