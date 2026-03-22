'use client';

import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center h-16 px-4">
        <button 
          onClick={() => router.back()} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 ml-2 flex items-center gap-1.5">
          <ShieldCheck size={20} className="text-indigo-600" /> 개인정보처리방침
        </h1>
      </div>

      {/* Content */}
      <div className="p-6 pb-20 space-y-8 text-gray-700 leading-relaxed max-w-none">
        <section>
          <p className="text-sm">
            <strong>Task Allocator Pro</strong>(이하 &quot;앱&quot;)는 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보 및 권익을 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같은 개인정보처리방침을 둡니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">1. 수집하는 개인정보의 항목 및 수집 방법</h2>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
            <p>앱은 회원가입, 원활한 업무 배정 서비스 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-600">
              <li><strong>필수 수집항목:</strong> 이메일 주소, 비밀번호, 이름(혹은 닉네임)</li>
              <li><strong>서비스 이용 과정 수집항목:</strong> 업무 스케줄(교대 근무 시간표 및 휴가 일정), 권한 수준(Role)</li>
              <li><strong>수집 방법:</strong> 앱/웹사이트 회원가입 폼 및 사내 관리자 초대(초대 코드)</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">2. 개인정보의 수집 및 이용 목적</h2>
          <div className="space-y-2 text-sm">
            <p>수집한 개인정보는 다음의 목적을 위해 활용됩니다.</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>사내 인력의 공정한 업무 및 스케줄 자동 배정 알고리즘 구동</li>
              <li>회원 식별, 불량 회원의 부정 이용 방지 및 비인가 사용 방지</li>
              <li>서비스 제공에 관한 알림(Push Notification) 및 주요 공지사항 전달</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">3. 개인정보의 보유 및 이용 기간</h2>
          <p className="text-sm">
            원칙적으로, 개인정보 수집 및 이용 목적이 달성된 후(회원 탈퇴 등)에는 해당 정보를 지체 없이 파기합니다. 단, 앱 관리자(Master)에 의해 탈퇴 처리되거나 직접 계정을 삭제하는 즉시 모든 연관 데이터(스케줄 포함)는 영구 삭제 처리됩니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">4. 개인정보의 제3자 제공</h2>
          <p className="text-sm">
            앱은 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 사내 업무 확인 목적으로 사용되는 본 소프트웨어 특성상 동일 그룹(앱 내 소속된 회사/조직) 내의 다른 직원 및 관리자에게 성명, 배정된 업무 스케줄 내역 등의 최소 정보가 상호 공개됩니다. 외부 광고나 제3자 마케팅을 위해서는 절대 공유되지 않습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">5. 개인정보의 파기절차 및 방법</h2>
          <p className="text-sm">
            이용자가 탈퇴 요청 시, 사내 데이터베이스(Supabase) 내 계정 정보 및 할당된 업무 내역 일체는 복구 불가능한 방법으로 즉각 삭제(Delete) 처리됩니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-l-4 border-indigo-600 pl-3">6. 이용자의 권리와 그 행사 방법</h2>
          <p className="text-sm">
            이용자는 언제든지 등록되어 있는 자신의 개인정보를 열람하거나 수정할 수 있으며, 가입 해지(동의 철회)를 요청할 수 있습니다. 개인정보 조회, 수정 및 탈퇴는 앱 내 '내 정보(My Page)' 메뉴의 계정 관리 기능 또는 사내 최고 관리자(Master)를 통해 가능합니다.
          </p>
        </section>

        <section className="pt-4 mt-6 border-t border-gray-100 flex justify-between items-end">
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">시행 일자</p>
            <p className="text-sm font-semibold text-gray-800">2026년 3월 1일</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 text-right mb-1">문의처</p>
            <p className="text-sm font-semibold text-gray-800">사내 시스템 관리부서</p>
          </div>
        </section>
      </div>
    </div>
  );
}
