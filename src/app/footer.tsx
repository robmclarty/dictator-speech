import { FOOTER_DISCLAIMER } from './copy'

interface FooterProps {
  readonly totalGenerated?: number
}

/**
 * Disclaimer + the cheeky lifetime address counter. The counter renders
 * only when `totalGenerated > 0` so first-load doesn't read "0 addresses
 * delivered" before any speech has been produced.
 */
export function Footer({ totalGenerated }: FooterProps = {}) {
  return (
    <footer className="footer">
      {totalGenerated !== undefined && totalGenerated > 0 && (
        <p className="footer-counter">
          {totalGenerated === 1
            ? '1 address delivered to a grateful nation.'
            : `${totalGenerated} addresses delivered to a grateful nation.`}
        </p>
      )}
      <p className="footer-disclaimer">{FOOTER_DISCLAIMER}</p>
    </footer>
  )
}
