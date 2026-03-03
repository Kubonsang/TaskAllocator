import { createClient } from '@supabase/supabase-js';

// 이 파일은 클라이언트 사이드와 서버 사이드 모두에서 사용될 수 있는 기본 Supabase 클라이언트입니다.
// .env.local 파일에 설정된 환경변수를 통해 초기화됩니다.
// 아직 환경변수가 없다면 경고 문구를 띄우도록 처리했습니다.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
