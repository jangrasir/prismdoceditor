import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Shield,
  Zap,
  Wand2,
  Moon,
  Sun,
  Check,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "PDF Studio",
    desc: "Merge, split, and reorder pages — entirely in your browser. Your files never leave your device.",
  },
  {
    icon: ImageIcon,
    title: "Image Workshop",
    desc: "Crop, resize, rotate, compress, and convert between JPG and PNG with a precision slider.",
  },
  {
    icon: Wand2,
    title: "AI Suggestions",
    desc: "Auto-tag uploads and get smart recommendations for the best format and next action.",
  },
  {
    icon: Shield,
    title: "Privacy first",
    desc: "All editing happens locally. Only you decide what gets saved to your encrypted library.",
  },
  {
    icon: Zap,
    title: "Instant tools",
    desc: "No queues, no waiting. Drag, drop, edit, download — typically in under 3 seconds.",
  },
  {
    icon: Sparkles,
    title: "Beautifully simple",
    desc: "A modern workspace that respects your time. Dark mode, keyboard-friendly, fully responsive.",
  },
];

export default function Landing() {
  const { session } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const cta = session ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 container mx-auto max-w-6xl flex items-center justify-between py-6 px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" onClick={() => navigate(session ? "/dashboard" : "/auth")}>
            {session ? "Dashboard" : "Sign in"}
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90" onClick={() => navigate(cta)}>
            Get started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 container mx-auto max-w-6xl px-4 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-4 py-1.5 text-xs font-medium mb-6 animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-glow-pulse" />
          AI-powered. Browser-native. Zero uploads to third parties.
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-normal leading-[1.05] mb-6 animate-fade-in-up">
          Edit documents and media
          <br />
          <span className="text-gradient">at the speed of thought.</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Prism is your all-in-one workspace for PDFs, images, and audio. Merge, split, compress,
          convert, trim, fade, and get AI suggestions — all in seconds, all in your browser.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <Button
            size="lg"
            className="bg-gradient-primary hover:opacity-90 text-base px-7 h-12 shadow-glow"
            onClick={() => navigate(cta)}
          >
            Start editing free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="text-base h-12" onClick={() => navigate(cta)}>
            See it in action
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-10 text-sm text-muted-foreground">
          {["No credit card", "Files stay private", "Free forever tier"].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" />
              {item}
            </div>
          ))}
        </div>

        {/* Floating preview card */}
        <div className="relative mt-20 max-w-5xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="absolute -inset-1 bg-gradient-primary rounded-3xl blur-2xl opacity-30 animate-glow-pulse" />
          <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/70" />
                <div className="h-3 w-3 rounded-full bg-warning/70" />
                <div className="h-3 w-3 rounded-full bg-success/70" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 rounded-md bg-background/60 border border-border/60 px-3 py-1 text-xs text-muted-foreground font-mono max-w-xs mx-auto">
                <Shield className="h-3 w-3 text-success" />
                prism.app/pdf-tools
              </div>
              <div className="w-12" />
            </div>

            {/* App body */}
            <div className="grid grid-cols-12 gap-0 bg-background/40">
              {/* Sidebar */}
              <aside className="hidden md:flex col-span-3 flex-col gap-1 border-r border-border p-4">
                {[
                  { icon: FileText, label: "PDF Studio", active: true },
                  { icon: ImageIcon, label: "Image Workshop" },
                  { icon: Wand2, label: "AI Suggest" },
                  { icon: Shield, label: "Library" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                      item.active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
                <div className="mt-auto pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="h-2 w-16 rounded bg-muted-foreground/40" />
                      <div className="mt-1 h-1.5 w-10 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                </div>
              </aside>

              {/* Main */}
              <main className="col-span-12 md:col-span-9 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold">Recent files</div>
                    <div className="text-xs text-muted-foreground mt-0.5">3 documents · synced</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md border border-border bg-background" />
                    <div className="h-7 px-3 rounded-md bg-gradient-primary flex items-center text-[11px] font-medium text-primary-foreground">
                      Upload
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { Icon: FileText, name: "Q4-Report.pdf", meta: "12 pages", tint: "from-primary/20 to-primary/5" },
                    { Icon: ImageIcon, name: "hero-shot.png", meta: "2.4 MB", tint: "from-accent/25 to-accent/5" },
                    { Icon: Wand2, name: "tags-suggested", meta: "AI · 5 tags", tint: "from-success/20 to-success/5" },
                  ].map(({ Icon, name, meta, tint }) => (
                    <div
                      key={name}
                      className="group rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden"
                    >
                      <div className={`aspect-[4/3] bg-gradient-to-br ${tint} flex items-center justify-center border-b border-border`}>
                        <Icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="p-3">
                        <div className="text-xs font-medium truncate">{name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{meta}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI suggestion strip */}
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary">
                    <Wand2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">AI tip</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Compress hero-shot.png to WebP — save ~68% with no visible loss.
                    </div>
                  </div>
                  <div className="hidden sm:block text-[11px] font-medium text-primary">Apply</div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 container mx-auto max-w-6xl px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Everything you need.{" "}
            <span className="text-gradient">Nothing you don't.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A focused toolkit built for speed, privacy, and beautiful output.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-1 transition-all"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-soft opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary mb-4 shadow-glow">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 container mx-auto max-w-4xl px-4 pb-24">
        <div className="relative rounded-3xl bg-gradient-primary p-12 md:p-16 text-center overflow-hidden shadow-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to work smarter?
            </h2>
            <p className="text-primary-foreground/90 mb-8 max-w-md mx-auto">
              Join thousands editing files faster — without the bloat.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="text-base h-12 px-8 hover:scale-105 transition-transform"
              onClick={() => navigate(cta)}
            >
              Get started — free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 container mx-auto max-w-6xl px-4 py-8 border-t border-border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Logo />
          <p>© {new Date().getFullYear()} Prism. Built for creators.</p>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
