import NetworkStatus from './NetworkStatus';

export default function Header() {
  return (
    <header className="bg-zbucks-cream border-b border-zbucks-brown/10 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zbucks-green leading-none">
            Zbucks<span className="text-zbucks-brown">Coffee</span>
          </h1>
          <p className="text-xs text-zbucks-mute mt-1">
            Shielded coffee. Paid in ZEC.
          </p>
        </div>
        <NetworkStatus />
      </div>
    </header>
  );
}
