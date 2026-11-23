import { createFileRoute } from "@tanstack/react-router";

import { ClinicCheckInScanner } from "@/components/clinic-check-in-scanner";

export const Route = createFileRoute("/clinic/check-in")({
  head: () => ({
    meta: [
      { title: "Patient check-in | CarePulse Clinic" },
      { name: "description", content: "Clinic staff scan CarePulse appointment passes to check patients in." },
      { property: "og:title", content: "Patient check-in | CarePulse Clinic" },
      { property: "og:description", content: "Clinic staff scan CarePulse appointment passes to check patients in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClinicCheckInScanner,
});
