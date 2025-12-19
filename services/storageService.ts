
import { StaffMember, DailyCloseRecord, WeeklySchedule } from '../types';

const STAFF_KEY = 'bigborda_staff';
const RECORDS_KEY = 'bigborda_records';
const SCHEDULE_KEY = 'bigborda_schedule';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const getStaff = (): StaffMember[] => {
  const data = localStorage.getItem(STAFF_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveStaff = (staff: StaffMember[]) => {
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
};

export const getRecords = (): DailyCloseRecord[] => {
  const data = localStorage.getItem(RECORDS_KEY);
  const records: DailyCloseRecord[] = data ? JSON.parse(data) : [];
  // Sort by date descending
  return records.sort((a, b) => b.date.localeCompare(a.date));
};

export const saveRecords = (records: DailyCloseRecord[]) => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

export const getRecordByDate = (date: string): DailyCloseRecord | undefined => {
  const records = getRecords();
  return records.find(r => r.date === date);
};

export const deleteRecord = (date: string) => {
  const records = getRecords();
  const filtered = records.filter(r => r.date !== date);
  saveRecords(filtered);
};

export const upsertRecord = (record: DailyCloseRecord) => {
  const records = getRecords();
  const index = records.findIndex(r => r.date === record.date);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  saveRecords(records);
};

export const getWeeklySchedule = (): WeeklySchedule => {
  const data = localStorage.getItem(SCHEDULE_KEY);
  // Default structure if empty
  const defaultSchedule: WeeklySchedule = {
    segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: []
  };
  return data ? { ...defaultSchedule, ...JSON.parse(data) } : defaultSchedule;
};

export const saveWeeklySchedule = (schedule: WeeklySchedule) => {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
};