/**
 * Auto-Assigner Core Algorithm (Fuzzy Logic & Set Assignments) v3.0
 */

export interface AlgorithmUser {
  id: string;
  name: string;
  totalScore: number;
  availableTimeSlots: { start: number; end: number }[]; // e.g., [{start: 9.0, end: 12.5}]
}

export interface AlgorithmTask {
  id: string;
  title: string;
  intensity: number; // 0.5 ~ 3.0
  startHour: number; // 9.0, 9.5 ...
  endHour: number;   // 10.0, 18.0 ...
  setId?: string;    // [NEW] 세트 업무 그룹핑을 위한 ID (VBA의 '세트명' 역할)
  preferredUsers?: string[]; // (우선 인력) 매칭 시 강력한 점수 혜택
  dislikedUsers?: string[];  // (후순위 인력) 매칭 시 큰 점수 페널티
  excludedUsers?: string[];  // (불가능 인력) 매칭 시 극단적 페널티 (-9999) -> 진짜 아무도 없을 때만 선택됨
}

export interface AssignmentResult {
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  assignedHours: number;
  scoreAdded: number;
}

// --------------------------------------------------------
// 보조 함수 (Utils)
// --------------------------------------------------------

// 1. 시간 30분(0.5) 단위 스냅
const snapTime = (x: number) => Math.round(x * 2) / 2;

// 2. 외부 주입 가능한 셔플 (기본값은 Math.random)
function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 3. 업무 시간이 유저의 남은 시간에 완전히 포함되는지 체크
function isUserAvailableForTasks(userSlots: { start: number; end: number }[], tasks: AlgorithmTask[]): boolean {
  for (const t of tasks) {
    const isAvailable = userSlots.some(slot => slot.start <= t.startHour && slot.end >= t.endHour);
    if (!isAvailable) return false; // 하나라도 안 맞으면 불가
  }
  return true;
}

// 4. 할당된 시간만큼 유저의 가용 시간 깎아내기 (Time Slicing)
function reduceTimeSlots(userSlots: { start: number; end: number }[], taskStart: number, taskEnd: number) {
  const newSlots: { start: number; end: number }[] = [];
  for (const slot of userSlots) {
    if (taskEnd <= slot.start || taskStart >= slot.end) {
      newSlots.push(slot);
      continue;
    }
    if (slot.start < taskStart) newSlots.push({ start: slot.start, end: taskStart });
    if (slot.end > taskEnd) newSlots.push({ start: taskEnd, end: slot.end });
  }
  return newSlots;
}

// 5. 퍼지 추첨기
function pickFuzzyCandidate(
  users: (AlgorithmUser & { tempScore: number })[], 
  fuzzyMargin: number,
  rng: () => number
) {
  if (users.length === 0) return null;
  const minScore = Math.min(...users.map(u => u.tempScore));
  const candidates = users.filter(u => u.tempScore <= minScore + fuzzyMargin);
  const randomIndex = Math.floor(rng() * candidates.length);
  return candidates[randomIndex];
}

// --------------------------------------------------------
// 메인 배정 알고리즘
// --------------------------------------------------------

export function assignTasks(
  users: AlgorithmUser[], 
  tasks: AlgorithmTask[], 
  options?: { fuzzyMargin?: number; rng?: () => number }
): AssignmentResult[] {
  const fuzzyMargin = options?.fuzzyMargin ?? 1.5;
  const rng = options?.rng ?? Math.random;

  const results: AssignmentResult[] = [];
  
  // 상태 복사 및 0.5 스냅 적용
  const currentUsers = users.map(u => ({
    ...u,
    tempScore: u.totalScore,
    tempTimeSlots: u.availableTimeSlots.map(s => ({ start: snapTime(s.start), end: snapTime(s.end) }))
  }));

  const sanitizedTasks = tasks.map(t => {
    const s = snapTime(t.startHour);
    const e = snapTime(t.endHour);
    if (e <= s) throw new Error(`유효하지 않은 시간: ${t.title} (${s}~${e})`);
    if (t.intensity < 0.5 || t.intensity > 3.0) throw new Error(`유효하지 않은 강도: ${t.title}`);
    return { ...t, startHour: s, endHour: e };
  });

  // 업무를 세트와 싱글로 분리
  const setMap = new Map<string, AlgorithmTask[]>();
  const singleTasks: AlgorithmTask[] = [];

  for (const t of sanitizedTasks) {
    if (t.setId && t.setId.trim() !== '') {
      if (!setMap.has(t.setId)) setMap.set(t.setId, []);
      setMap.get(t.setId)!.push(t);
    } else {
      singleTasks.push(t);
    }
  }

  // --- PHASE 1: 세트(Set) 단위 배정 ---
  const setKeys = shuffleArray(Array.from(setMap.keys()), rng);
  
  for (const key of setKeys) {
    const subTasks = setMap.get(key)!;
    // 세트 내 모든 업무를 소화할 수 있는 유저 찾기
    const availableUsers = currentUsers.filter(u => isUserAvailableForTasks(u.tempTimeSlots, subTasks));
    
    if (availableUsers.length === 0) {
      console.warn(`[배정 실패] 세트 ${key}를 통째로 맡을 수 있는 인원이 없습니다.`);
      continue; // 분할 배정하지 않고 건너뜀 (VBA 원본 원칙)
    }

    // --- 우선/후순위/불가능 인력 페널티/보너스 적용 ---
    // 세트 내 하나라도 불가능/우선/후순위에 해당하면 해당 점수를 합산합시다.
    const candidatesWithScore = availableUsers.map(u => {
      let weight = 0;
      for (const t of subTasks) {
        if (t.excludedUsers?.includes(u.id)) weight -= 9999;
        if (t.dislikedUsers?.includes(u.id)) weight -= 500;
        if (t.preferredUsers?.includes(u.id)) weight += 500;
      }
      return { ...u, tempScore: u.tempScore - weight }; // weight가 높을수록 tempScore가 낮아져(유리해짐) fuzzy picking에 앞섭니다.
    });

    const selectedUser = pickFuzzyCandidate(candidatesWithScore, fuzzyMargin, rng);
    
    if (selectedUser) {
      let totalScoreAdded = 0;
      for (const t of subTasks) {
        const reqHours = t.endHour - t.startHour;
        const score = reqHours * t.intensity;
        totalScoreAdded += score;
        
        results.push({
          userId: selectedUser.id,
          userName: selectedUser.name,
          taskId: t.id,
          taskTitle: t.title + ' (Set)',
          assignedHours: reqHours,
          scoreAdded: score
        });

        // 시간 깎기
        const userRef = currentUsers.find(u => u.id === selectedUser.id)!;
        userRef.tempTimeSlots = reduceTimeSlots(userRef.tempTimeSlots, t.startHour, t.endHour);
      }
      // 세트 완료 후 점수 갱신
      currentUsers.find(u => u.id === selectedUser.id)!.tempScore += totalScoreAdded;
    }
  }

  // --- PHASE 2: 싱글(Single) 업무 배정 ---
  const shuffledSingles = shuffleArray(singleTasks, rng);

  for (const t of shuffledSingles) {
    const availableUsers = currentUsers.filter(u => isUserAvailableForTasks(u.tempTimeSlots, [t]));

    if (availableUsers.length === 0) {
      console.warn(`[배정 실패] ${t.title} (${t.startHour}~${t.endHour}) 가능한 인원 없음.`);
      continue;
    }

    // --- 우선/후순위/불가능 인력 페널티/보너스 적용 ---
    const candidatesWithScore = availableUsers.map(u => {
      let weight = 0;
      if (t.excludedUsers?.includes(u.id)) weight -= 9999;
      if (t.dislikedUsers?.includes(u.id)) weight -= 500;
      if (t.preferredUsers?.includes(u.id)) weight += 500;
      
      return { ...u, tempScore: u.tempScore - weight }; // weight>0 이면 tempScore가 감소하여 퍼지 추첨 1순위가 됨
    });

    const selectedUser = pickFuzzyCandidate(candidatesWithScore, fuzzyMargin, rng);

    if (selectedUser) {
      const reqHours = t.endHour - t.startHour;
      const scoreAdded = reqHours * t.intensity;
      
      results.push({
        userId: selectedUser.id,
        userName: selectedUser.name,
        taskId: t.id,
        taskTitle: t.title,
        assignedHours: reqHours,
        scoreAdded
      });

      const userRef = currentUsers.find(u => u.id === selectedUser.id)!;
      userRef.tempScore += scoreAdded;
      userRef.tempTimeSlots = reduceTimeSlots(userRef.tempTimeSlots, t.startHour, t.endHour);
    }
  }

  return results;
}