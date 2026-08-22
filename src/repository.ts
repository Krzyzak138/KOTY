import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CareActivity, CareEvent, Cat, Feeding, Meal, Person, trackingDate } from './domain';

const FEEDINGS_KEY = '@koci-posilek/feedings';
const CARE_KEY = '@koci-posilek/care-events';
export const PERSON_KEY = '@koci-posilek/person';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const client: SupabaseClient | null = url && key ? createClient(url, key) : null;

type DbFeeding = {
  id: string;
  cat: Cat;
  meal: Meal;
  fed_at: string;
  fed_by: Person;
  local_date: string;
  batch_id: string | null;
};

type DbCareEvent = {
  id: string;
  activity: CareActivity;
  cat: Cat | null;
  done_at: string;
  done_by: Person;
  local_date: string;
};

const fromDb = (row: DbFeeding): Feeding => ({
  id: row.id,
  cat: row.cat,
  meal: row.meal,
  fedAt: row.fed_at,
  fedBy: row.fed_by,
  localDate: row.local_date,
  batchId: row.batch_id,
});

const careFromDb = (row: DbCareEvent): CareEvent => ({
  id: row.id,
  activity: row.activity,
  cat: row.cat,
  doneAt: row.done_at,
  doneBy: row.done_by,
  localDate: row.local_date,
});

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function localList(): Promise<Feeding[]> {
  const raw = await AsyncStorage.getItem(FEEDINGS_KEY);
  return raw ? (JSON.parse(raw) as Feeding[]) : [];
}

async function localCareList(): Promise<CareEvent[]> {
  const raw = await AsyncStorage.getItem(CARE_KEY);
  return raw ? (JSON.parse(raw) as CareEvent[]) : [];
}

export const repository = {
  isOnline: Boolean(client),

  async list(): Promise<Feeding[]> {
    if (!client) return localList();
    const { data, error } = await client
      .from('feedings')
      .select('*')
      .order('fed_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data as DbFeeding[]).map(fromDb);
  },

  async add(cats: Cat[], meal: Meal, fedBy: Person): Promise<Feeding[]> {
    const now = new Date();
    const batchId = cats.length > 1 ? makeId() : null;
    const items: Feeding[] = cats.map((cat) => ({
      id: makeId(),
      cat,
      meal,
      fedAt: now.toISOString(),
      fedBy,
      localDate: trackingDate(now),
      batchId,
    }));
    if (!client) {
      const existing = await localList();
      await AsyncStorage.setItem(FEEDINGS_KEY, JSON.stringify([...items, ...existing]));
      return items;
    }
    const rows = items.map((item) => ({
      id: item.id,
      cat: item.cat,
      meal: item.meal,
      fed_at: item.fedAt,
      fed_by: item.fedBy,
      local_date: item.localDate,
      batch_id: item.batchId,
    }));
    const { data, error } = await client.from('feedings').insert(rows).select();
    if (error) throw error;
    return (data as DbFeeding[]).map(fromDb);
  },

  async listCare(): Promise<CareEvent[]> {
    if (!client) return localCareList();
    const { data, error } = await client
      .from('care_events')
      .select('*')
      .order('done_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data as DbCareEvent[]).map(careFromDb);
  },

  async addCare(activity: CareActivity, cat: Cat | null, doneBy: Person): Promise<CareEvent> {
    const now = new Date();
    const item: CareEvent = {
      id: makeId(),
      activity,
      cat,
      doneAt: now.toISOString(),
      doneBy,
      localDate: trackingDate(now),
    };
    if (!client) {
      const existing = await localCareList();
      await AsyncStorage.setItem(CARE_KEY, JSON.stringify([item, ...existing]));
      return item;
    }
    const { data, error } = await client.from('care_events').insert({
      id: item.id,
      activity: item.activity,
      cat: item.cat,
      done_at: item.doneAt,
      done_by: item.doneBy,
      local_date: item.localDate,
    }).select().single();
    if (error) throw error;
    return careFromDb(data as DbCareEvent);
  },

  subscribe(onChange: () => void): () => void {
    if (!client) return () => undefined;
    const channel = client
      .channel('family-care-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedings' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_events' }, onChange)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
