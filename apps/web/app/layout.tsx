import type { Metadata } from "next";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";
import "./graphics.css";
import "./booking.css";
import "./theme-black.css";
import "./intelligence.css";
import "./access-os.css";
import "./login/login.css";
import "./brand-refresh.css";
import "./whatsapp.css";
import "./standout.css";
import "./brand-art.css";
import "./brand-direction.css";
import "./contacts.css";
import "./onboarding/onboarding.css";
import "./onboarding/profile-photo.css";
import "./onboarding/profile-photo-operator.css";
import "./onboarding/profile-learning.css";
import "./premium-polish.css";
import "./apply.css";
import "./membership.css";
import "./membership-invite.css";
import "./trust-centre.css";
import "./trust-data-controls.css";
import "./intelligence-brief.css";

export const metadata: Metadata = {
  title: { default: "Vector Privé", template: "%s · Vector Privé" },
  description: "One message. Consider it handled. Your private lifestyle office for travel, dining and life in motion.",
  applicationName: "Vector Privé",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Vector Privé" },
  icons: {
    icon: "/images/vector-prive-vp-icon.png",
    apple: "/images/vector-prive-vp-icon.png",
  },
  formatDetection: { telephone: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthBootstrap/><PwaRegistration/>{children}</body></html>;
}
