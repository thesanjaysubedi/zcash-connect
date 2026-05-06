type FooterProps = {
  onToggleDevTools?: () => void;
  devToolsOpen?:     boolean;
};

export default function Footer({ onToggleDevTools, devToolsOpen }: FooterProps) {
  return (
    <footer className="border-t border-zbucks-brown/10 mt-16">
      <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <p className="text-xs text-zbucks-mute">
          Powered by <span className="font-semibold text-zbucks-green">ZcashConnect</span>
          <span className="mx-2">·</span>
          ZIP-321 · ZIP-316 · lightwalletd
        </p>
        {onToggleDevTools && (
          <button
            onClick={onToggleDevTools}
            className="text-xs text-zbucks-mute hover:text-zbucks-green transition-colors"
          >
            {devToolsOpen ? 'Hide developer tools ▴' : 'Developer tools ▸'}
          </button>
        )}
      </div>
    </footer>
  );
}
