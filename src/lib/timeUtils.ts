/**
 * 시간을 다루는 유틸리티 함수들 (Phase 3.5 알고리즘 v3.0 대응)
 */

/**
 * "HH:mm" 형태의 문자열을 float(숫자) 형식으로 변환합니다.
 * 예) "09:30" => 9.5
 */
export function timeStringToFloat(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

/**
 * float(숫자) 형태의 시간을 "HH:mm" 문자열 형식으로 변환합니다.
 * 예) 9.5 => "09:30"
 */
export function floatToTimeString(timeFloat: number): string {
  if (isNaN(timeFloat)) return "00:00";
  const hours = Math.floor(timeFloat);
  const minutes = Math.round((timeFloat - hours) * 60);
  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}
