import { getLocalDateKey } from './messageFormatter';

export const formatDateGroupHeader = (key: string): string => {
  if (key === 'Today') return 'Today';
  if (key === 'Yesterday') return 'Yesterday';

  const todayKey = getLocalDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterdayDate);
  
  if (key === todayKey) return 'Today'; 
  if (key === yesterdayKey) return 'Yesterday';

  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
};
