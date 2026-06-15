'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WelcomeCarousel from '@/components/WelcomeCarousel';
import { markIntroSeen } from '@/lib/welcome';

function WelcomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const explicitNext = searchParams.get('next');
  const nextPath = explicitNext || '/auth/register';
  const isRevisit = explicitNext !== null;

  const handleComplete = () => {
    markIntroSeen();
    router.push(nextPath);
  };

  const handleSkip = () => {
    markIntroSeen();
    router.push(isRevisit ? nextPath : '/auth/login');
  };

  const handleLogin = () => {
    markIntroSeen();
    router.push('/auth/login');
  };

  return (
    <WelcomeCarousel
      onComplete={handleComplete}
      onSkip={handleSkip}
      onLogin={isRevisit ? undefined : handleLogin}
      showSkip={true}
      coverImageSrc="/images/welcome/cover.png"
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomePageInner />
    </Suspense>
  );
}
