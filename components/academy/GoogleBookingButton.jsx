'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

const SCHEDULING_SCRIPT_ID = 'google-calendar-scheduling-button-script';
const SCHEDULING_STYLESHEET_ID = 'google-calendar-scheduling-button-stylesheet';

export default function GoogleBookingButton({
  label = 'Book a conversation',
  className = '',
}) {
  const targetRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function loadButton() {
      if (
        cancelled ||
        !targetRef.current ||
        !window.calendar?.schedulingButton
      ) {
        return;
      }

      targetRef.current.innerHTML = '';

      window.calendar.schedulingButton.load({
        url: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1ETXAH3UEku6hG6x0PrYOjtW7aiB-lrTU1PXia0mgTIR0C3gJHfthFFFuic4KfeLUhbEx3UbM5?gv=true',
        color: '#2563EB',
        label,
        target: targetRef.current,
      });
    }

    function loadGoogleSchedulingScript() {
      const existingScript = document.getElementById(SCHEDULING_SCRIPT_ID);

      if (window.calendar?.schedulingButton) {
        loadButton();
        return;
      }

      if (existingScript) {
        existingScript.addEventListener('load', loadButton, { once: true });
        return;
      }

      const stylesheet = document.createElement('link');
      stylesheet.id = SCHEDULING_STYLESHEET_ID;
      stylesheet.rel = 'stylesheet';
      stylesheet.href =
        'https://calendar.google.com/calendar/scheduling-button-script.css';
      document.head.appendChild(stylesheet);

      const script = document.createElement('script');
      script.id = SCHEDULING_SCRIPT_ID;
      script.src =
        'https://calendar.google.com/calendar/scheduling-button-script.js';
      script.async = true;
      script.addEventListener('load', loadButton, { once: true });

      document.body.appendChild(script);
    }

    loadGoogleSchedulingScript();

    return () => {
      cancelled = true;
    };
  }, [label]);

  return (
    <div
      ref={targetRef}
      className={`google-calendar-booking-button ${className}`}
    />
  );
}