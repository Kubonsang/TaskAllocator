export type Role = 'Admin' | 'Master' | 'Worker';

export interface User {
  id: string;
  name: string;
  role: Role;
  totalScore: number;
  avatarUrl?: string;
  availableTimeSlots?: { start: number; end: number }[];
}

export interface Task {
  id: string;
  title: string;
  intensity: number; // 0.5 to 3.0
  startHour: number; // e.g. 9.0
  endHour: number;   // e.g. 11.0
  setId?: string;
  color: string; // Tailwind color class or hex
  location?: string;
  description?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // Algorithm v3.0 format
  endHour: number;
  isSwapRequested: boolean;
  swapRequestedByUserId?: string;
  note?: string; 
}

export const DUMMY_USERS: User[] = [
  { id: 'u1', name: '김동욱', role: 'Worker', totalScore: 125.5, availableTimeSlots: [{ start: 9.0, end: 18.0 }] },
  { id: 'u2', name: '이지은', role: 'Worker', totalScore: 110.0, availableTimeSlots: [{ start: 9.0, end: 18.0 }] },
  { id: 'u3', name: '박민수', role: 'Admin', totalScore: 140.2, availableTimeSlots: [{ start: 9.0, end: 18.0 }] },
  { id: 'u4', name: '최윤아', role: 'Worker', totalScore: 95.8, availableTimeSlots: [{ start: 9.0, end: 18.0 }] },
];

export const TASK_TYPES: Record<string, Task> = {
  t1: { id: 't1', title: '고객 응대 (CS)', intensity: 2.0, startHour: 9.0, endHour: 11.0, color: 'bg-red-100 text-red-800', location: '1층 CS 센터', description: '고객 문의 및 클레임 대응 업무, 전화 및 대면 응대 포함' },
  t2: { id: 't2', title: '서류 작업', intensity: 1.0, startHour: 11.0, endHour: 12.0, color: 'bg-blue-100 text-blue-800', location: '사무실 (자율좌석)', description: '각종 보고서 작성 및 결재 서류 검토 작업' },
  t3: { id: 't3', title: '외근 (현장 확인)', intensity: 3.0, startHour: 13.0, endHour: 16.0, color: 'bg-purple-100 text-purple-800', location: '서울시 강남구 현장', description: '현장 실사 및 협력 업체 미팅, 이동 시간 포함' },
  t4: { id: 't4', title: '데이터 입력', intensity: 0.5, startHour: 16.0, endHour: 17.0, color: 'bg-green-100 text-green-800', location: '사무실 내 개인석', description: '전일 발생한 실적 데이터 ERP 시스탬 내 수동 입력' },
  t5: { id: 't5', title: '휴가/반차', intensity: 0, startHour: 17.0, endHour: 18.0, color: 'bg-gray-200 text-gray-500', location: '-', description: '개인 사정으로 인한 휴가 처리' }, // Special task for time block
};

export const DUMMY_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    userId: 'u1',
    taskId: 't1',
    date: new Date().toISOString().split('T')[0], // Today
    startHour: 9.0,
    endHour: 11.0,
    isSwapRequested: false,
  },
  {
    id: 's2',
    userId: 'u1',
    taskId: 't2',
    date: new Date().toISOString().split('T')[0],
    startHour: 11.0,
    endHour: 12.0,
    isSwapRequested: true,
    swapRequestedByUserId: 'u2',
  },
  {
    id: 's3',
    userId: 'u1',
    taskId: 't3',
    date: new Date().toISOString().split('T')[0],
    startHour: 13.0,
    endHour: 16.0,
    isSwapRequested: false,
  },
  {
    id: 's4',
    userId: 'u1',
    taskId: 't5', // 1시간 단위 외출/휴가
    date: new Date().toISOString().split('T')[0],
    startHour: 16.0,
    endHour: 17.0,
    isSwapRequested: false,
    note: '병원 진료',
  }
];

// Current logged in user for prototype
export const CURRENT_USER_ID = 'u3';
