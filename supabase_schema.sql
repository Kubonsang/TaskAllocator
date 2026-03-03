-- "Auto-Assigner Pro" Supabase Database Schema

-- [기존 테이블이 있을 경우 삭제하고 다시 생성하려면 주석 옵션을 제거하세요]
-- DROP TABLE IF EXISTS swap_requests CASCADE;
-- DROP TABLE IF EXISTS schedules CASCADE;
-- DROP TABLE IF EXISTS rules CASCADE;
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles (Extends Supabase Auth users)
-- Stores custom application user data like role and assignment scores.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE, -- 로그인 시 사용하는 아이디 (내부 이메일에서 쭬라마크 @ 앞부분이 짧 아이디와 동일)
  role TEXT CHECK (role IN ('Admin', 'Requester', 'Worker')) NOT NULL DEFAULT 'Worker',
  total_score NUMERIC DEFAULT 0.0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 1-1. Invite Tokens (One-time registration links)
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL, -- 초대용 고유 토큰
  role TEXT CHECK (role IN ('Admin', 'Requester', 'Worker')) NOT NULL DEFAULT 'Worker',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tasks Taxonomy (Master list of task types)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  intensity NUMERIC NOT NULL,
  start_hour NUMERIC NOT NULL DEFAULT 9.0,
  end_hour NUMERIC NOT NULL DEFAULT 10.0,
  set_id TEXT,
  color TEXT,
  location TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Schedules (The actual assigned timeline blocks)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_hour NUMERIC NOT NULL,
  end_hour NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Swap Requests (Requests to swap a specific schedule block)
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'Accepted', 'Rejected')) DEFAULT 'Pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Config/Rules (Algorithm limits & settings)
CREATE TABLE IF NOT EXISTS rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  randomness_fuzz_limit NUMERIC DEFAULT 1.5 NOT NULL,
  settings_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS) policies [Optional/Basic setup]
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for now
CREATE POLICY "Allow authenticated read access" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON swap_requests FOR SELECT USING (auth.role() = 'authenticated');

-- RLS for invites table
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated invites read" ON invites FOR SELECT USING (auth.role() = 'authenticated');
-- Allow service_role to insert/update (used by our API route)
CREATE POLICY "Allow service insert invites" ON invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update invites" ON invites FOR UPDATE USING (true);

-- 6. Auth Trigger: Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1), -- username = 이메일에서 @ 앞 부분 (아이디)
    COALESCE(new.raw_user_meta_data->>'role', 'Worker') -- 메타데이터의 role 사용
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 먼저 삭제하고 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
