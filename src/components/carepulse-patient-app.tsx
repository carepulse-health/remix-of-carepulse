import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestPatientAccountLink, usePatientSession, type PatientAppointment, type PatientClinic, type PatientPass, type PatientRecordState } from "@/hooks/use-patient-session";
import { useDoctorDirectory } from "@/hooks/use-doctor-directory";
import { usePatientNotifications, type PatientNotificationsState } from "@/hooks/use-patient-notifications";
import { appointmentPassQrValue, appointmentStatusLabel, isCheckedInStatus, isPassActive, isPassValid, isUpcomingAppointment, localDateKey } from "@/lib/appointment-pass";
import { downloadAppointmentPass } from "@/lib/download-appointment-pass";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import type { Json } from "@/integrations/supabase/types";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Phone,
  RefreshCw,
  FileHeart,
  HeartPulse,
  House,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircleHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import consultationPhoto from "@/assets/carepulse-consultation.jpg";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type View = "home" | "doctors" | "appointments" | "assistant" | "notifications" | "account";
type AccountView = "login" | "register" | "forgot";

type NavItem = { id: View; label: string; icon: typeof House };

export const primaryNavigation: NavItem[] = [
  { id: "home", label: "Home", icon: House },
  { id: "doctors", label: "Find a Doctor", icon: Stethoscope },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "notifications", label: "Inbox", icon: Bell },
  { id: "account", label: "Account", icon: UserRound },
];

const moreNavigation: NavItem[] = [
  { id: "assistant", label: "Care assistant", icon: MessageCircleHeart },
];

const SIDEBAR_STORAGE_KEY = "carepulse.sidebar-collapsed";

export function PatientSidebar({ activeView, onNavigate, unreadCount, collapsed = false, onToggleCollapsed, accountName, accountDetail, initials }: {
  activeView: View;
  onNavigate: (view: View) => void;
  unreadCount: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  accountName: string;
  accountDetail: string;
  initials: string;
}) {
  const item = ({ id, label, icon: Icon }: NavItem) => {
    const active = activeView === id;
    return (
      <li key={id}>
        <Button variant="ghost" onClick={() => onNavigate(id)} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}
          className={`relative h-10 w-full gap-3 rounded-md text-sm font-medium ${collapsed ? "justify-center px-0" : "justify-start px-3"} ${active ? "bg-care-mist text-care-deep hover:bg-care-mist" : "text-muted-foreground hover:text-care-deep"}`}>
          {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-care-teal" />}
          <Icon className={`size-[17px] shrink-0 ${active ? "text-care-teal" : ""}`} />
          <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
          {id === "notifications" && unreadCount > 0 && <span className={`${collapsed ? "absolute right-3 top-2" : "ml-auto"} size-2 rounded-full bg-care-teal`} aria-label={`${unreadCount} unread`} />}
        </Button>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
        <button className="flex items-center gap-2.5 text-left" onClick={() => onNavigate("home")} aria-label="CarePulse home">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-care-deep text-primary-foreground"><HeartPulse className="size-5" /></span>
          {!collapsed && <span className="font-display text-[20px] font-bold tracking-tight text-care-deep">carepulse<span className="text-care-teal">.</span></span>}
        </button>
      </div>
      <nav aria-label="Main navigation" className="mt-8 flex-1 overflow-y-auto">
        {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold text-muted-foreground">YOUR SPACE</p>}
        <ul className="space-y-1">{primaryNavigation.map(item)}</ul>
        {!collapsed ? <p className="mb-2 mt-6 px-3 text-[10px] font-semibold text-muted-foreground">MORE</p> : <div className="my-4 border-t border-care-line" />}
        <ul className="space-y-1">{moreNavigation.map(item)}</ul>
      </nav>
      <div className="mt-4 space-y-2 border-t border-care-line pt-4">
        <Button variant="ghost" onClick={() => onNavigate("account")} title={collapsed ? accountName : undefined} className={`h-auto w-full gap-3 rounded-md py-2 text-left ${collapsed ? "justify-center px-0" : "justify-start px-2"}`}>
          <Avatar className="size-9 shrink-0 rounded-md bg-care-panel"><AvatarFallback className="rounded-md bg-care-panel text-xs font-semibold text-care-deep">{initials}</AvatarFallback></Avatar>
          {collapsed ? <span className="sr-only">{accountName}</span> : <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-care-ink">{accountName}</span><span className="block truncate text-xs text-muted-foreground">{accountDetail}</span></span>}
        </Button>
        {onToggleCollapsed && (
          <Button variant="ghost" size="sm" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className={`w-full gap-2 text-xs text-muted-foreground ${collapsed ? "justify-center px-0" : "justify-start px-3"}`}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
          </Button>
        )}
      </div>
    </div>
  );
}

const heading: Record<Exclude<View, "account">, { title: string; eyebrow: string }> = {
  home: { title: "Your care, at a glance.", eyebrow: "PATIENT HOME" },
  doctors: { title: "Meet your care team.", eyebrow: "DOCTOR DIRECTORY" },
  appointments: { title: "Your visits, all in one place.", eyebrow: "APPOINTMENTS" },
  assistant: { title: "A little more support.", eyebrow: "CARE ASSISTANT" },
  notifications: { title: "The latest from your clinic.", eyebrow: "NOTIFICATIONS" },
};

function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-care-ink">{title}</h2>
        {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function SampleLabel({ liveLabel }: { liveLabel: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-care-line bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      <span className={`size-1.5 rounded-full ${liveLabel ? "bg-care-teal" : "bg-care-amber"}`} /> {liveLabel ?? "SAMPLE PREVIEW"}
    </span>
  );
}

function doctorInitials(name: string | null) {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "DR";
}

function doctorTone(index: number) {
  return ["bg-care-panel text-care-deep", "bg-secondary text-primary", "bg-muted text-muted-foreground"][index % 3] ?? "bg-care-panel text-care-deep";
}

function scheduleLabel(day: string | null, start: string | null, end: string | null) {
  const time = start && end ? `${start.slice(0, 5)}–${end.slice(0, 5)}` : "Hours not listed";
  return `${day ?? "Day not listed"} · ${time}`;
}

function DirectoryMessage({ status, message, signedIn, onLink }: { status: "disabled" | "loading" | "error" | "ready"; message: string | undefined; signedIn: boolean; onLink: (() => void) | undefined }) {
  const text = status === "loading"
    ? "Loading your clinic directory…"
    : status === "error"
      ? message ?? "The clinic directory couldn’t be loaded right now."
      : status === "disabled"
        ? signedIn ? "Link your clinic record to view its clinic directory." : "Sign in to view your clinic directory."
        : "No clinic doctors are currently listed.";

  return <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground"><p>{text}</p>{status === "disabled" && onLink && <Button variant="link" onClick={onLink} className="h-auto p-0 text-xs text-care-teal">{signedIn ? "Link record" : "Sign in"}</Button>}</div>;
}

function DoctorRow({ doctor, tone, scheduleText, onBook }: { doctor: { id: string | null; full_name: string | null; specialization: string | null }; tone: string; scheduleText: string; onBook: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-care-line/70 py-3 last:border-b-0 last:pb-0">
      <Avatar className={`size-11 rounded-md ${tone}`}>
        <AvatarFallback className={`${tone} rounded-md text-xs font-semibold`}>{doctorInitials(doctor.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-care-ink">{doctor.full_name ?? "Doctor"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{doctor.specialization ?? "Specialty not listed"}</p>
      </div>
      <Button onClick={onBook} variant="outline" size="sm" disabled={!doctor.id} className="shrink-0 px-2.5 text-xs">
        {scheduleText ? "View times" : "No times"}
      </Button>
    </div>
  );
}

export function CarePulsePatientApp() {
  const [activeView, setActiveView] = useState<View>("home");
  const { session, record, refreshRecord } = usePatientSession();
  const [directoryRefreshToken, setDirectoryRefreshToken] = useState(0);
  const directory = useDoctorDirectory(record.status === "linked", directoryRefreshToken);
  const [accountView, setAccountView] = useState<AccountView>("login");
  const [searchTerm, setSearchTerm] = useState("");
  const [bannerOpen, setBannerOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chosenDoctor, setChosenDoctor] = useState<string | null>(null);
  const [appointmentTab, setAppointmentTab] = useState<"upcoming" | "past">("upcoming");
  const [openAppointmentId, setOpenAppointmentId] = useState<string | null>(null);
  const availableDoctors = directory.status === "ready" ? directory.doctors : [];
  const filteredDoctors = useMemo(
    () => availableDoctors.filter((doctor) => `${doctor.full_name ?? ""} ${doctor.specialization ?? ""}`.toLowerCase().includes(searchTerm.toLowerCase())),
    [availableDoctors, searchTerm],
  );
  const selectedDoctor = availableDoctors.find((doctor) => doctor.id === chosenDoctor);
  const selectedSchedules = directory.status === "ready" ? directory.schedules.filter((schedule) => schedule.doctor_id === chosenDoctor && schedule.is_available) : [];

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setSidebarCollapsed(saved === null ? window.innerWidth < 1024 : saved === "true");
  }, []);

  const toggleSidebar = () => setSidebarCollapsed((value) => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!value));
    return !value;
  });

  const go = (view: View) => {
    setActiveView(view);
    setMenuOpen(false);
    if (view === "home") setChosenDoctor(null);
    setOpenAppointmentId(null);
  };

  const bookDoctor = (doctorId?: string | null) => {
    setActiveView("doctors");
    setChosenDoctor(doctorId ?? null);
  };

  const bookFirstListedDoctor = () => bookDoctor(availableDoctors.find((doctor) =>
    directory.status === "ready" && directory.schedules.some((schedule) => schedule.doctor_id === doctor.id && schedule.is_available),
  )?.id);

  const current = activeView === "account" ? null : heading[activeView];
  const notifications = usePatientNotifications(session?.user.id);
  const linked = record.status === "linked" ? record : null;
  const unreadCount = notifications.status === "ready" ? notifications.notifications.filter((item) => !item.is_read).length : 0;
  const today = localDateKey();
  const nextAppointment = linked?.appointments
    .filter((appointment) => isUpcomingAppointment(appointment.appointment_date, today))
    .sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`))[0];
  const liveLabel = activeView === "doctors"
    ? directory.status === "ready" ? "CLINIC DIRECTORY" : null
    : (activeView === "home" || activeView === "appointments") && linked
      ? "CLINIC RECORD"
      : activeView === "notifications" && notifications.status === "ready" ? "CLINIC UPDATES" : null;
  const patientInitials = linked?.patient.full_name ? doctorInitials(linked.patient.full_name) : "PA";
  const accountName = linked?.patient.full_name ?? (session ? "My account" : "Patient account");
  const accountDetail = session?.user.email ?? "Sign in";

  return (
    <div className="min-h-screen bg-care-paper text-care-ink">

      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside aria-label="Sidebar" className={`sticky top-0 hidden h-screen shrink-0 border-r border-care-line/80 bg-background py-6 transition-[width] duration-200 md:block ${sidebarCollapsed ? "w-[76px] px-3" : "w-[240px] px-4"}`}>
          <PatientSidebar activeView={activeView} onNavigate={go} unreadCount={unreadCount} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} accountName={accountName} accountDetail={accountDetail} initials={patientInitials} />
        </aside>

        <div className="min-w-0 flex-1">
          {bannerOpen && (
            <div className="relative flex min-h-8 items-center justify-center gap-2 bg-care-deep px-10 py-1.5 text-center text-[11px] font-medium text-primary-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-care-amber" />
              {linked ? "Connected to your clinic record · Screening remains unavailable" : record.status === "unlinked" ? <>Signed in · Link your clinic record to see your visits <Button variant="link" onClick={() => go("account")} className="h-auto p-0 text-[11px] font-semibold text-primary-foreground underline">Link record</Button></> : "Preview content is sample-only · Sign in to view your clinic directory"}
              <Button variant="ghost" size="icon" aria-label="Dismiss preview notice" onClick={() => setBannerOpen(false)} className="absolute right-2 h-6 w-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <X className="size-3" />
              </Button>
            </div>
          )}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-care-line/80 bg-background/95 px-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-1.5">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu" className="relative"><Menu className="size-5" />{unreadCount > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-care-teal ring-2 ring-background" />}</Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] max-w-[85vw] px-4 py-6">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SheetDescription className="sr-only">Move between your CarePulse pages.</SheetDescription>
                  <PatientSidebar activeView={activeView} onNavigate={go} unreadCount={unreadCount} accountName={accountName} accountDetail={accountDetail} initials={patientInitials} />
                </SheetContent>
              </Sheet>
              <button onClick={() => go("home")} className="font-display text-[19px] font-bold tracking-tight text-care-deep">carepulse<span className="text-care-teal">.</span></button>
            </div>
            <SampleLabel liveLabel={liveLabel} />
          </header>

          <main className="mx-auto max-w-[1140px] px-4 pb-12 pt-6 sm:px-7 md:pt-9 lg:px-10">
            {current && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold text-care-teal">{current.eyebrow}</p><h1 className="mt-1 font-display text-[27px] font-semibold leading-tight tracking-tight text-care-ink sm:text-[32px]">{current.title}</h1></div>
              <Badge variant="outline" className="gap-1.5 border-care-line bg-background text-[10px] font-medium text-muted-foreground"><span className={`size-1.5 rounded-full ${liveLabel || activeView === "doctors" ? "bg-care-teal" : "bg-care-amber"}`} /> {liveLabel ?? (activeView === "doctors" ? "CLINIC DIRECTORY" : "DEMO DATA")}</Badge>
            </div>}

            {activeView === "home" && <div className="space-y-7">
              {record.status === "unlinked" && <section aria-label="Link your clinic record" className="rounded-md border border-care-teal/40 bg-care-panel/60 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-background text-care-teal"><ShieldCheck className="size-5" /></span><div><p className="text-sm font-semibold text-care-ink">Link your clinic record</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Connect this account to the patient record your clinic holds for {session?.user.email ?? "your email"} to see your visits and passes.</p></div></div><LinkClinicRecordPanel onLinked={() => { refreshRecord(); setDirectoryRefreshToken((token) => token + 1); }} onAlreadyLinked={refreshRecord} className="sm:w-[220px]" /></div></section>}
              <section className="relative isolate min-h-[235px] overflow-hidden rounded-md bg-care-deep sm:min-h-[260px]" aria-label="Welcome to CarePulse">
                <img src={consultationPhoto} alt="Doctor having a calm conversation with a patient" width={1536} height={1024} className="absolute inset-0 -z-20 size-full object-cover object-[center_43%]" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-care-deep/95 via-care-deep/85 to-care-deep/10" />
                <div className="flex min-h-[235px] max-w-[570px] flex-col items-start justify-center px-5 py-6 sm:min-h-[260px] sm:px-8">
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-medium text-primary-foreground"><Sparkles className="size-3" /> A little easier, every step</span>
                  <h2 className="max-w-[390px] font-display text-[25px] font-semibold leading-[1.1] text-primary-foreground sm:text-[30px]">Good care starts with feeling heard.</h2>
                  <p className="mt-2 max-w-[335px] text-sm leading-relaxed text-primary-foreground/80">Find a doctor, keep visits together, and take your next step at your own pace.</p>
                  <Button onClick={bookFirstListedDoctor} className="mt-5 gap-2 bg-primary-foreground text-care-deep hover:bg-primary-foreground/90">Find a doctor <ArrowRight className="size-4" /></Button>
                </div>
                {!linked && <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-primary-foreground/30 bg-care-deep/60 px-2.5 py-1 text-[9px] font-medium text-primary-foreground"><span className="size-1.5 rounded-full bg-care-amber" /> SAMPLE APPOINTMENT</div>}
              </section>

              <div className="grid gap-7 xl:grid-cols-[1.4fr_0.95fr]">
                <div className="space-y-7">
                  <section>
                    <SectionTitle title="Your upcoming visit" detail={linked ? "From your clinic record." : "A sample appointment for preview only."} action={<Button variant="link" onClick={() => go("appointments")} className="h-8 gap-1 p-0 text-xs text-care-teal">All appointments <ArrowRight className="size-3.5" /></Button>} />
                    {linked ? <LiveUpcomingVisit appointment={nextAppointment} hasPass={Boolean(nextAppointment && isPassValid(linked.passes.find((pass) => pass.appointment_id === nextAppointment.id), nextAppointment.status))} clinicAddress={linked.clinic?.address ?? null} onOpen={() => { go("appointments"); if (nextAppointment) setOpenAppointmentId(nextAppointment.id); }} /> : <>
                    <article className="overflow-hidden rounded-md border border-care-line bg-background">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-care-line bg-care-panel/70 px-4 py-2.5">
                        <span className="flex items-center gap-2 text-xs font-semibold text-care-deep"><span className="size-2 rounded-full bg-care-amber" /> SAMPLE PREVIEW</span><span className="text-xs text-muted-foreground">Request not submitted</span>
                      </div>
                      <div className="grid gap-5 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-care-mist text-care-teal"><CalendarDays className="size-[21px]" /></div>
                          <div><p className="text-sm font-semibold text-care-ink">Friday, November 13</p><p className="mt-1 text-xs text-muted-foreground">11:30 AM · Family medicine</p><p className="mt-2 text-xs text-care-ink">Doctor assigned on clinic record</p></div>
                        </div>
                        <Button onClick={() => go("appointments")} variant="outline" size="sm" className="gap-2 sm:self-center">View appointment <ArrowRight className="size-3.5" /></Button>
                      </div>
                    </article>
                    </>}
                  </section>

                  <section>
                    <SectionTitle title="A doctor for you" detail="Clinicians and available times from your clinic directory" action={<Button variant="link" onClick={() => go("doctors")} className="h-8 gap-1 p-0 text-xs text-care-teal">Meet the team <ArrowRight className="size-3.5" /></Button>} />
                    <div className="rounded-md border border-care-line bg-background px-4 py-1 sm:px-5">
                      {directory.status === "ready" && availableDoctors.length > 0 ? availableDoctors.slice(0, 2).map((doctor, index) => {
                        const scheduleText = directory.schedules.filter((schedule) => schedule.doctor_id === doctor.id && schedule.is_available).slice(0, 2).map((schedule) => scheduleLabel(schedule.day_of_week, schedule.start_time, schedule.end_time)).join(" · ");
                        return <DoctorRow key={doctor.id ?? `doctor-${index}`} doctor={doctor} tone={doctorTone(index)} scheduleText={scheduleText} onBook={() => bookDoctor(doctor.id)} />;
                      }) : <DirectoryMessage status={directory.status} message={directory.status === "error" ? directory.message : undefined} signedIn={Boolean(session)} onLink={() => go(session ? "account" : "account")} />}
                    </div>
                  </section>
                </div>

                <div className="space-y-7">
                  <section>
                    <SectionTitle title="Find your next step" />
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => go("doctors")} className="group flex min-h-[119px] flex-col items-start justify-between rounded-md border border-care-line bg-background p-4 text-left transition-colors hover:bg-care-mist/50"><span className="grid size-9 place-items-center rounded-md bg-care-panel text-care-teal"><Stethoscope className="size-[18px]" /></span><span className="flex w-full items-center justify-between gap-1 text-sm font-semibold">Find a doctor <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span></button>
                      <button onClick={() => go("appointments")} className="group flex min-h-[119px] flex-col items-start justify-between rounded-md border border-care-line bg-background p-4 text-left transition-colors hover:bg-care-mist/50"><span className="grid size-9 place-items-center rounded-md bg-secondary text-primary"><Plus className="size-[18px]" /></span><span className="flex w-full items-center justify-between gap-1 text-sm font-semibold">Book a visit <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span></button>
                    </div>
                  </section>
                  <section>
                    <SectionTitle title="Care, with a little help" />
                    <button onClick={() => go("assistant")} className="group w-full overflow-hidden rounded-md border border-care-line bg-care-panel/70 p-4 text-left transition-colors hover:bg-care-panel sm:p-5">
                      <span className="mb-4 flex items-center justify-between"><span className="grid size-10 place-items-center rounded-md bg-background text-care-teal"><MessageCircleHeart className="size-[19px]" /></span><Badge variant="outline" className="border-care-line bg-background text-[9px] text-muted-foreground">NOT CONNECTED</Badge></span>
                      <span className="block text-sm font-semibold text-care-ink">Care assistant</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">The screening guide will appear here after clinic safety rules are set.</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-care-teal">More about this <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                    </button>
                  </section>
                  <section className="border-t border-care-line pt-5">
                    {linked ? <LiveClinicHours clinic={linked.clinic} /> : <>
                    <div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-care-teal" /><h2 className="text-sm font-semibold">Clinic hours</h2><Badge variant="outline" className="ml-auto border-care-line text-[9px] text-muted-foreground">SAMPLE</Badge></div>
                    <p className="text-xs text-muted-foreground">Monday – Friday <span className="float-right font-medium text-care-ink">8:00 AM – 5:00 PM</span></p>
                    <p className="mt-2 text-xs text-muted-foreground">Saturday <span className="float-right font-medium text-care-ink">9:00 AM – 1:00 PM</span></p>
                    </>}
                  </section>
                </div>
              </div>
            </div>}

            {activeView === "doctors" && <div className="space-y-5">
              <section className="flex flex-col justify-between gap-4 border-b border-care-line pb-5 sm:flex-row sm:items-end">
                <div><p className="text-sm text-muted-foreground">Clinicians listed in your clinic’s directory.</p><p className="mt-1 text-xs text-muted-foreground">Only available clinic schedules are shown.</p></div>
                <label className="relative block w-full sm:max-w-[280px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name or specialty" aria-label="Search doctors" className="pl-9" /></label>
              </section>
              {chosenDoctor && <div role="status" className="flex items-start justify-between gap-3 rounded-md border border-care-line bg-care-panel/60 p-4"><div className="flex gap-3"><div className="grid size-9 place-items-center rounded-md bg-background text-care-teal"><CalendarDays className="size-4" /></div><div><p className="text-sm font-semibold">Available times{selectedDoctor?.full_name ? ` · ${selectedDoctor.full_name}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Times shown are read from the clinic schedule.</p><div className="mt-3 flex flex-wrap gap-2">{selectedSchedules.length ? selectedSchedules.map((schedule) => <Badge key={schedule.id} variant="outline" className="border-care-line bg-background font-medium text-care-deep">{scheduleLabel(schedule.day_of_week, schedule.start_time, schedule.end_time)}</Badge>) : <span className="text-xs text-muted-foreground">No available times are currently listed.</span>}</div></div></div><Button variant="ghost" size="icon" aria-label="Close doctor times" onClick={() => setChosenDoctor(null)}><X className="size-4" /></Button></div>}
              {directory.status === "ready" ? <div className="divide-y divide-care-line rounded-md border border-care-line bg-background px-4 sm:px-5">{filteredDoctors.length ? filteredDoctors.map((doctor, index) => {
                const schedules = directory.schedules.filter((schedule) => schedule.doctor_id === doctor.id && schedule.is_available);
                const tone = doctorTone(index);
                return <article key={doctor.id} className="flex flex-wrap items-center gap-3 py-4 sm:gap-4"><Avatar className={`size-12 rounded-md ${tone}`}><AvatarFallback className={`${tone} rounded-md text-xs font-semibold`}>{doctorInitials(doctor.full_name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{doctor.full_name ?? "Doctor"}</p><p className="mt-0.5 text-xs text-muted-foreground">{doctor.specialization ?? "Specialty not listed"}</p><p className="mt-1.5 flex items-center gap-1 text-[11px] text-care-teal"><Clock3 className="size-3" />{schedules.length ? `${schedules.length} available ${schedules.length === 1 ? "schedule" : "schedules"}` : "No available schedule listed"}</p></div><Button onClick={() => bookDoctor(doctor.id)} variant="outline" size="sm" disabled={!schedules.length} className="gap-1.5">View times <ArrowRight className="size-3.5" /></Button></article>;
              }) : <p className="py-8 text-center text-sm text-muted-foreground">No clinic doctors match that search.</p>}</div> : <div className="rounded-md border border-care-line bg-background px-4 py-1 sm:px-5"><DirectoryMessage status={directory.status} message={directory.status === "error" ? directory.message : undefined} signedIn={Boolean(session)} onLink={() => go("account")} /></div>}
            </div>}

            {activeView === "appointments" && <div className="space-y-5">
              {!(linked && openAppointmentId) && <section className="flex flex-wrap items-center justify-between gap-3 border-b border-care-line pb-4"><p className="text-sm text-muted-foreground">{linked ? "Appointments booked for you by your clinic." : "Sample appointments · no booking information is stored."}</p><div className="flex gap-1 rounded-md bg-muted p-1"><Button size="sm" variant={appointmentTab === "upcoming" ? "default" : "ghost"} onClick={() => setAppointmentTab("upcoming")} className="h-8 px-3 text-xs">Upcoming</Button><Button size="sm" variant={appointmentTab === "past" ? "default" : "ghost"} onClick={() => setAppointmentTab("past")} className="h-8 px-3 text-xs">Past visits</Button></div></section>}
              {record.status === "linked" ? (openAppointmentId && record.appointments.some((a) => a.id === openAppointmentId) ? <AppointmentDetails appointment={record.appointments.find((a) => a.id === openAppointmentId)!} pass={record.passes.find((pass) => pass.appointment_id === openAppointmentId)} clinic={record.clinic} onBack={() => setOpenAppointmentId(null)} onRefresh={refreshRecord} /> : <LiveAppointments record={record} tab={appointmentTab} today={today} onOpen={setOpenAppointmentId} />) : appointmentTab === "upcoming" ? <article className="max-w-2xl overflow-hidden rounded-md border border-care-line bg-background"><div className="flex items-center justify-between gap-2 border-b border-care-line bg-care-panel/60 px-4 py-3"><span className="flex items-center gap-2 text-xs font-semibold text-care-deep"><span className="size-2 rounded-full bg-care-amber" /> EXAMPLE REQUEST</span><Badge variant="outline" className="border-care-line bg-background text-[10px]">Not submitted</Badge></div><div className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-display text-xl font-semibold">Friday, November 13</p><p className="mt-1 text-sm text-muted-foreground">11:30 AM · Family medicine</p></div><span className="grid size-11 place-items-center rounded-md bg-care-mist text-care-teal"><CalendarDays className="size-5" /></span></div><div className="mt-5 space-y-3 border-t border-care-line pt-4 text-sm"><p className="flex items-center gap-2"><Stethoscope className="size-4 text-care-teal" />Doctor assigned on clinic record</p><p className="flex items-center gap-2"><MapPin className="size-4 text-care-teal" />Clinic location · sample only</p></div><div className="mt-5 border-t border-care-line pt-4"><Button onClick={() => go("doctors")} variant="outline" size="sm" className="gap-2"><Plus className="size-3.5" /> Explore clinic directory</Button><p className="mt-3 text-[11px] text-muted-foreground">Appointment passes are unavailable until the clinic connection is configured.</p></div></div></article> : <div className="max-w-2xl rounded-md border border-care-line bg-background px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-muted text-muted-foreground"><FileHeart className="size-[18px]" /></span><div><p className="text-sm font-semibold">Annual wellness visit</p><p className="mt-1 text-xs text-muted-foreground">Sample history · Tuesday, September 8</p></div><span className="ml-auto text-xs text-muted-foreground">Example only</span></div></div>}
            </div>}
{activeView === "assistant" && (

  <div className="max-w-4xl space-y-4">
    <section className="overflow-hidden rounded-md border border-care-line bg-background">
      <div className="border-b border-care-line p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">
          CarePulse AI Assistant
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with the CarePulse assistant for screening support.
        </p>
      </div>

  <iframe
    src="https://carepulse-screening-bridge-88jp.vercel.app/"
    title="CarePulse AI Health Assistant"
    className="h-[75vh] min-h-[650px] w-full border-0"
    allow="microphone"
    allowFullScreen
    loading="lazy"
  />

  <div className="border-t border-care-line p-4">
    <p className="mb-3 text-xs text-muted-foreground">
      This assistant does not replace professional medical care.
    </p>
    <a
      href="https://carepulse-screening-bridge-88jp.vercel.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-md bg-care-teal px-4 py-2 text-sm font-medium text-white"
    >
      Open CarePulse Assistant
    </a>
  </div>
</section>

  </div>
)}

            {activeView === "notifications" && (session ? <LiveNotifications state={notifications} /> : <div className="max-w-2xl"><p className="mb-5 text-sm text-muted-foreground">Sample updates only · no messages from a live clinic.</p><div className="divide-y divide-care-line rounded-md border border-care-line bg-background px-4"><article className="flex gap-3 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-care-panel text-care-teal"><CalendarDays className="size-4" /></span><div><p className="text-sm font-semibold">Your appointment is confirmed <Badge variant="outline" className="ml-1 border-care-line text-[9px] text-muted-foreground">SAMPLE</Badge></p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sample update for Friday, November 13 at 11:30 AM.</p><p className="mt-2 text-[10px] text-muted-foreground">Example · 2 days ago</p></div></article><article className="flex gap-3 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><BadgeCheck className="size-4" /></span><div><p className="text-sm font-semibold">Welcome to CarePulse</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Explore the app in sample mode while the clinic connection is being prepared.</p><p className="mt-2 text-[10px] text-muted-foreground">Example · Last week</p></div></article></div></div>)}

            {activeView === "account" && <AccountScreen accountView={accountView} onSetView={setAccountView} session={session} record={record} refreshRecord={refreshRecord} onAccountLinked={() => setDirectoryRefreshToken((token) => token + 1)} />}
          </main>

          <footer className="hidden border-t border-care-line px-8 py-4 text-center text-[10px] text-muted-foreground md:block">{linked ? "CarePulse · Not for emergencies · Contact your clinic for urgent care" : "CarePulse · Sample preview · Not for clinical use"}</footer>
        </div>
      </div>

    </div>
  );
}

function formatVisitDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatVisitTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  return new Date(2000, 0, 1, Number(hours), Number(minutes)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function LiveUpcomingVisit({ appointment, hasPass, clinicAddress, onOpen }: { appointment: PatientAppointment | undefined; hasPass: boolean; clinicAddress: string | null; onOpen: () => void }) {
  if (!appointment) return <div className="rounded-md border border-care-line bg-background px-4 py-5 text-sm text-muted-foreground">No upcoming appointments on your clinic record. Your clinic will add visits here once they’re booked.</div>;
  const checkedIn = isCheckedInStatus(appointment.status);
  return (
    <article className="overflow-hidden rounded-md border border-care-line bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-care-line bg-care-panel/70 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold capitalize text-care-deep"><span className="size-2 rounded-full bg-care-teal" /> {appointmentStatusLabel(appointment.status)}</span><span className="text-xs text-muted-foreground">{checkedIn ? "You're checked in — please wait to be called." : hasPass ? "Appointment pass ready" : "Pass not issued yet"}</span>
      </div>
      <div className="grid gap-5 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-care-mist text-care-teal"><CalendarDays className="size-[21px]" /></div>
          <div><p className="text-sm font-semibold text-care-ink">{formatVisitDate(appointment.appointment_date)}</p><p className="mt-1 text-xs text-muted-foreground">{formatVisitTime(appointment.appointment_time)}{appointment.doctor?.specialization ? ` · ${appointment.doctor.specialization}` : ""}</p><p className="mt-2 text-xs text-care-ink">{appointment.doctor?.full_name ?? "Doctor to be assigned"}{clinicAddress ? ` · ${clinicAddress}` : ""}</p></div>
        </div>
        <Button onClick={onOpen} variant="outline" size="sm" className="gap-2 sm:self-center">View appointment <ArrowRight className="size-3.5" /></Button>
      </div>
    </article>
  );
}

function openingHoursRows(hours: Json | null): [string, string][] {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return [];
  return Object.entries(hours).flatMap(([day, value]): [string, string][] => {
    if (typeof value === "string" && value.trim()) return [[day, value]];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const open = value["open"];
      const close = value["close"];
      if (typeof open === "string" && typeof close === "string") return [[day, `${open} – ${close}`]];
      if (value["closed"] === true) return [[day, "Closed"]];
    }
    return [];
  });
}

function LiveClinicHours({ clinic }: { clinic: PatientClinic | null }) {
  const rows = openingHoursRows(clinic?.opening_hours ?? null);
  return (
    <>
      <div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-care-teal" /><h2 className="text-sm font-semibold">Clinic hours</h2><Badge variant="outline" className="ml-auto border-care-line text-[9px] text-muted-foreground">CLINIC RECORD</Badge></div>
      {clinic?.name && <p className="mb-2 text-xs font-medium text-care-ink">{clinic.name}</p>}
      {rows.length ? rows.map(([day, value]) => <p key={day} className="mt-2 text-xs capitalize text-muted-foreground first:mt-0">{day} <span className="float-right font-medium normal-case text-care-ink">{value}</span></p>) : <p className="text-xs text-muted-foreground">Your clinic hasn’t listed its opening hours yet.</p>}
      {clinic?.phone && <p className="mt-3 text-xs text-muted-foreground">Phone <a href={`tel:${clinic.phone}`} className="float-right font-medium text-care-teal">{clinic.phone}</a></p>}
    </>
  );
}

const visitInstructions = [
  "Arrive 15 minutes early to check in at the front desk.",
  "Bring a photo ID and any referral letters or test results.",
  "Bring a list of the medicines you currently take.",
  "Show your appointment pass at the front desk when you arrive.",
  "If you can’t make it, call the clinic as early as possible to reschedule.",
];

function AppointmentPassPanel({ appointment, pass, clinic, onRefresh }: { appointment: PatientAppointment; pass: PatientPass | undefined; clinic: PatientClinic | null; onRefresh: () => void }) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const valid = isPassValid(pass, appointment.status);
  const qrValue = valid && pass ? appointmentPassQrValue(pass.reference_code, pass.qr_code) : null;

  if (isCheckedInStatus(appointment.status)) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-md border border-care-line bg-care-panel/60 p-5">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-care-teal" />
        <p className="text-sm font-medium text-care-ink">You're checked in — please wait to be called.</p>
      </div>
    );
  }

  if (!pass || !qrValue) {
    const expired = Boolean(pass && !isPassActive(pass.expires_at));
    return (
      <div className="rounded-md border border-dashed border-care-line bg-care-panel/40 p-5 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-md bg-background text-care-teal"><ShieldCheck className="size-5" /></span>
        <p className="mt-3 text-sm font-medium text-care-ink">{expired ? "This appointment pass has expired. Contact your clinic for a new one." : "Your appointment pass will appear once the clinic confirms your visit."}</p>
        <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4 gap-2"><RefreshCw className="size-3.5" /> Check again</Button>
      </div>
    );
  }

  const download = async () => {
    setDownloadError(null);
    const canvas = qrCanvasRef.current;
    if (!canvas) return setDownloadError("The pass couldn’t be prepared. Please try again.");
    try {
      await downloadAppointmentPass({
        qrCanvas: canvas,
        referenceCode: pass.reference_code,
        clinicName: clinic?.name ?? "Your clinic",
        visitDate: formatVisitDate(appointment.appointment_date),
        visitTime: formatVisitTime(appointment.appointment_time),
        doctorName: appointment.doctor?.full_name ?? "To be assigned",
      });
    } catch {
      setDownloadError("The pass couldn’t be downloaded. Please try again.");
    }
  };

  return (
    <div className="rounded-md border border-care-line bg-background p-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-[10px] font-semibold text-muted-foreground">APPOINTMENT REFERENCE</p>
        <p className="font-mono text-lg font-semibold tracking-wider text-care-deep">{pass.reference_code}</p>
        <div className="rounded-md border border-care-line bg-background p-3"><QRCodeSVG value={qrValue} size={196} level="M" marginSize={1} role="img" aria-label={`QR code for appointment pass ${pass.reference_code}`} /></div>
        <QRCodeCanvas ref={qrCanvasRef} value={qrValue} size={720} level="M" marginSize={2} className="hidden" aria-hidden="true" />
        {pass.expires_at && <p className="text-[11px] text-muted-foreground">Valid until {new Date(pass.expires_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
        <p className="max-w-xs text-xs text-muted-foreground">Show this code at the clinic front desk. Keep it private — it’s unique to your visit.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => void download()} className="gap-2"><Download className="size-3.5" /> Download pass</Button>
          {pass.pdf_url && <Button asChild variant="outline" size="sm"><a href={pass.pdf_url} target="_blank" rel="noreferrer">Clinic PDF</a></Button>}
        </div>
        {downloadError && <p role="alert" className="text-xs text-destructive">{downloadError}</p>}
      </div>
    </div>
  );
}

export function AppointmentDetails({ appointment, pass, clinic, onBack, onRefresh }: { appointment: PatientAppointment; pass: PatientPass | undefined; clinic: PatientClinic | null; onBack: () => void; onRefresh: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ["Doctor", appointment.doctor?.full_name ?? "To be assigned"],
    ["Specialty", appointment.doctor?.specialization ?? "Not listed"],
    ["Clinic", clinic?.name ?? "Not listed"],
    ["Address", clinic?.address ?? "Not listed"],
    ["Phone", clinic?.phone ? <a href={`tel:${clinic.phone}`} className="inline-flex items-center gap-1 text-care-teal"><Phone className="size-3" />{clinic.phone}</a> : "Not listed"],
    ["Booked on", appointment.created_at ? new Date(appointment.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "Not recorded"],
  ];
  return (
    <div className="max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="size-3.5" /> All appointments</Button>
      <article className="overflow-hidden rounded-md border border-care-line bg-background">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-care-line bg-care-panel/60 p-5">
          <div><p className="text-[10px] font-semibold text-care-teal">APPOINTMENT</p><h2 className="mt-1 font-display text-xl font-semibold text-care-ink">{formatVisitDate(appointment.appointment_date)}</h2><p className="mt-1 text-sm text-muted-foreground">{formatVisitTime(appointment.appointment_time)}</p></div>
          <Badge variant="outline" className="border-care-line bg-background capitalize">{appointmentStatusLabel(appointment.status)}</Badge>
        </div>
        <dl className="divide-y divide-care-line/70 px-5">
          {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-care-ink">{value}</dd></div>)}
          {appointment.reason && <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">Reason</dt><dd className="text-right font-medium text-care-ink">{appointment.reason}</dd></div>}
        </dl>
      </article>
      <section aria-label="Appointment pass">
        <SectionTitle title="Appointment pass" />
        <AppointmentPassPanel appointment={appointment} pass={pass} clinic={clinic} onRefresh={onRefresh} />
      </section>
      <section aria-label="Visit instructions" className="rounded-md border border-care-line bg-background p-5">
        <h3 className="text-sm font-semibold">Before your visit</h3>
        <ul className="mt-3 space-y-2">{visitInstructions.map((item) => <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0 text-care-teal" />{item}</li>)}</ul>
        <p className="mt-4 border-t border-care-line pt-3 text-[11px] text-muted-foreground">General visit guidance. For urgent symptoms, contact your clinic or local emergency services.</p>
      </section>
    </div>
  );
}

function LiveAppointments({ record, tab, today, onOpen }: { record: Extract<PatientRecordState, { status: "linked" }>; tab: "upcoming" | "past"; today: string; onOpen: (id: string) => void }) {
  const list = record.appointments
    .filter((a) => (tab === "upcoming" ? isUpcomingAppointment(a.appointment_date, today) : !isUpcomingAppointment(a.appointment_date, today)))
    .sort((a, b) => (tab === "upcoming" ? 1 : -1) * `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`));
  if (list.length === 0) return <div className="max-w-2xl rounded-md border border-care-line bg-background px-4 py-6 text-sm text-muted-foreground">No {tab === "upcoming" ? "upcoming" : "past"} appointments on your clinic record.</div>;
  return <div className="max-w-2xl space-y-3">{list.map((a) => {
    const checkedIn = isCheckedInStatus(a.status);
    const hasPass = tab === "upcoming" && isPassValid(record.passes.find((item) => item.appointment_id === a.id), a.status);
    return <button key={a.id} type="button" onClick={() => onOpen(a.id)} aria-label={`View appointment on ${formatVisitDate(a.appointment_date)} at ${formatVisitTime(a.appointment_time)}`} className="group block w-full rounded-md border border-care-line bg-background px-4 py-3 text-left transition-colors hover:bg-care-mist/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-care-mist text-care-teal"><CalendarDays className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{formatVisitDate(a.appointment_date)} · {formatVisitTime(a.appointment_time)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{a.doctor?.full_name ?? "Doctor to be assigned"}{a.reason ? ` · ${a.reason}` : ""}</p>{checkedIn && <p className="mt-1 text-[11px] font-medium text-care-teal">You're checked in — please wait to be called.</p>}{hasPass && <p className="mt-1 text-[11px] font-medium text-care-teal">Appointment pass ready</p>}</div><Badge variant="outline" className="border-care-line text-[10px] capitalize">{appointmentStatusLabel(a.status)}</Badge><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div></button>;
  })}</div>;
}

function LiveNotifications({ state }: { state: PatientNotificationsState }) {
  const intro = state.status === "ready" ? "Updates sent to your account by your clinic." : state.status === "loading" ? "Loading your clinic updates…" : state.status === "error" ? state.message : "Sign in to see clinic updates.";
  return (
    <div className="max-w-2xl">
      <p className="mb-5 text-sm text-muted-foreground">{intro}</p>
      {state.status === "ready" && (state.notifications.length ? <div className="divide-y divide-care-line rounded-md border border-care-line bg-background px-4">{state.notifications.map((item) => (
        <article key={item.id} className="flex gap-3 py-4">
          <span className={`grid size-9 shrink-0 place-items-center rounded-md ${item.notification_type?.includes("appointment") ? "bg-care-panel text-care-teal" : "bg-secondary text-primary"}`}>{item.notification_type?.includes("appointment") ? <CalendarDays className="size-4" /> : <BadgeCheck className="size-4" />}</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}{!item.is_read && <span className="ml-2 inline-block size-1.5 rounded-full bg-care-teal align-middle" aria-label="Unread" />}</p><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{item.message}</p>{item.created_at && <p className="mt-2 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}</div>
        </article>
      ))}</div> : <div className="rounded-md border border-care-line bg-background px-4 py-6 text-sm text-muted-foreground">No updates from your clinic yet.</div>)}
    </div>
  );
}

export function linkErrorMessage(message: string) {
  if (message.includes("EMAIL_NOT_VERIFIED")) return "Confirm your email address before linking your clinic record.";
  if (message.includes("ALREADY_LINKED")) return "This account is already linked to a clinic record. Refreshing your profile.";
  if (message.includes("MULTIPLE_MATCHES")) return "The clinic needs to review multiple records matching this email. Contact the front desk.";
  if (message.includes("NOT_FOUND")) return "No clinic record matched your verified email. Contact the front desk for help.";
  return "Your clinic record couldn’t be linked right now. Please try again later.";
}

export function LinkClinicRecordPanel({ onLinked, onAlreadyLinked, className = "" }: { onLinked: () => void; onAlreadyLinked: () => void; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const link = async () => {
    setBusy(true);
    setNotice(null);
    const { error } = await requestPatientAccountLink();
    setBusy(false);
    if (error) {
      setNotice({ tone: "error", text: linkErrorMessage(error.message) });
      if (error.message.includes("ALREADY_LINKED")) onAlreadyLinked();
      return;
    }
    setNotice({ tone: "ok", text: "Your clinic record is linked. Loading your profile…" });
    onLinked();
  };
  return (
    <div className={`space-y-2 ${className}`}>
      <Button onClick={() => void link()} disabled={busy} className="w-full gap-2"><ShieldCheck className="size-4" />{busy ? "Checking clinic record…" : "Link my clinic record"}</Button>
      {notice && <p role="status" className={`rounded-md border p-2.5 text-xs ${notice.tone === "error" ? "border-destructive/40 text-destructive" : "border-care-line bg-background text-care-deep"}`}>{notice.text}</p>}
    </div>
  );
}

export function AccountScreen({ accountView, onSetView, session, record, refreshRecord, onAccountLinked }: { accountView: AccountView; onSetView: (view: AccountView) => void; session: Session | null; record: PatientRecordState; refreshRecord: () => void; onAccountLinked: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const titles: Record<AccountView, { title: string; detail: string }> = {
    login: { title: "Welcome back.", detail: "Sign in to your CarePulse patient account." },
    register: { title: "Create your account.", detail: "Use the email your clinic has on file so we can find your record." },
    forgot: { title: "Reset your password.", detail: "We’ll email you a secure link to choose a new password." },
  };
  const isRegister = accountView === "register";
  const isForgot = accountView === "forgot";

  if (session) {
    return (
      <section className="mx-auto max-w-md py-4 md:py-10">
        <Badge variant="outline" className="mb-3 gap-1.5 border-care-line bg-background text-[10px] font-medium text-muted-foreground"><ShieldCheck className="size-3" /> SIGNED IN</Badge>
        <h2 className="font-display text-[26px] font-semibold tracking-tight">Your patient profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">{session.user.email}</p>
        <div className="mt-6 rounded-md border border-care-line bg-background p-4 text-sm">
          {record.status === "loading" && <p className="text-muted-foreground">Looking up your clinic record…</p>}
          {record.status === "unlinked" && <div className="space-y-3"><p className="text-muted-foreground">Your account isn’t linked to a clinic patient record yet. Link the record matching your verified email address.</p><LinkClinicRecordPanel onLinked={() => { refreshRecord(); onAccountLinked(); }} onAlreadyLinked={refreshRecord} /></div>}
          {record.status === "blocked" && <div className="space-y-3"><p className="text-muted-foreground">{record.message}</p><Button variant="outline" size="sm" onClick={refreshRecord}>Try again</Button></div>}
          {record.status === "linked" && <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-care-line bg-care-panel/60 p-3 text-xs font-medium text-care-deep"><BadgeCheck className="size-4 shrink-0 text-care-teal" /> Clinic record linked{record.clinic?.name ? ` · ${record.clinic.name}` : ""}</div>}
          {record.status === "linked" && <dl className="space-y-2">{([["Name", record.patient.full_name], ["Date of birth", record.patient.date_of_birth], ["Phone", record.patient.phone], ["Email", record.patient.email], ["Address", record.patient.address], ["Emergency contact", [record.patient.emergency_contact_name, record.patient.emergency_contact_phone].filter(Boolean).join(" · ")]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>)}</dl>}
        </div>
        {notice && <p role="status" className={`mt-3 rounded-md border p-3 text-xs ${notice.tone === "error" ? "border-destructive/40 text-destructive" : "border-care-line bg-care-panel/60 text-care-deep"}`}>{notice.text}</p>}
        <Button variant="outline" className="mt-5 w-full" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const origin = window.location.origin;
    const result = isForgot
      ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })
      : isRegister
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin, data: { full_name: fullName } } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setNotice({ tone: "error", text: result.error.message });
    if (isForgot) setNotice({ tone: "ok", text: "If that email has an account, a reset link is on its way." });
    else if (isRegister && !("session" in result.data && result.data.session)) setNotice({ tone: "ok", text: "Check your email to confirm your account, then sign in." });
  };

  return (
    <section className="mx-auto max-w-md py-4 md:py-10">
      <div className="mb-7"><Badge variant="outline" className="mb-3 gap-1.5 border-care-line bg-background text-[10px] font-medium text-muted-foreground"><LockKeyhole className="size-3" /> SECURE ACCOUNT</Badge><h2 className="font-display text-[26px] font-semibold tracking-tight">{titles[accountView].title}</h2><p className="mt-2 text-sm text-muted-foreground">{titles[accountView].detail}</p></div>
      <form className="space-y-4" onSubmit={submit}>
        {isRegister && <label className="block text-xs font-medium">Full name<Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="mt-1.5 bg-background" /></label>}
        <label className="block text-xs font-medium">Email address<Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 bg-background" /></label>
        {!isForgot && <label className="block text-xs font-medium">Password<Input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="mt-1.5 bg-background" /></label>}
        {notice && <p role="status" className={`rounded-md border p-3 text-xs ${notice.tone === "error" ? "border-destructive/40 text-destructive" : "border-care-line bg-care-panel/60 text-care-deep"}`}>{notice.text}</p>}
        <Button type="submit" disabled={busy} className="w-full">{isRegister ? "Create patient account" : isForgot ? "Send reset link" : "Sign in"} <ArrowRight className="size-4" /></Button>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{!isForgot && <Button type="button" variant="link" onClick={() => onSetView(isRegister ? "login" : "register")} className="h-auto p-0 text-xs text-care-teal">{isRegister ? "Already registered? Sign in" : "Create an account"}</Button>}{!isRegister && <Button type="button" variant="link" onClick={() => onSetView(isForgot ? "login" : "forgot")} className="h-auto p-0 text-xs text-care-teal">{isForgot ? "Return to sign in" : "Forgot password?"}</Button>}</div>
      </form>
    </section>
  );
}
