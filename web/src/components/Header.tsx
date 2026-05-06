export default function Header() {
  return (
    <header className="bg-zbucks-cream border-b border-zbucks-brown/10 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zbucks-green">
            Zbucks<span className="text-zbucks-brown">Coffee</span>
          </h1>
          <p className="text-xs text-zbucks-mute mt-0.5">
            Shielded coffee. Paid in ZEC.
          </p>
        </div>
        <a
          href="https://github.com/thesanjaysubedi/zcash-connect"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zbucks-mute hover:text-zbucks-green transition-colors"
        >
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
