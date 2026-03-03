'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart2, CalendarPlus, User, Shield } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function BottomNav() {
  const pathname = usePathname();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession();
      let targetId: string | undefined = session?.user?.id;

      if (targetId) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', targetId).single();
        if (p && (p.role === 'Admin' || p.role === 'Master')) {
          setIsAdmin(true);
        }
      }
    }
    checkRole();
  }, [pathname]);

  let navItems = [
    { name: '홈', href: '/', icon: Home },
    { name: '일정/휴가', href: '/schedule', icon: CalendarPlus },
    { name: '통계', href: '/stats', icon: BarChart2 },
    { name: '마이정보', href: '/my', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ name: '대표업무', href: '/admin', icon: Shield });
  }

  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
