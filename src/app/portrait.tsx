import portraitUrl from '../theme/leader.svg'
import { PORTRAIT_ALT } from './copy'

export function Portrait() {
  return (
    <div className="portrait">
      <img className="portrait-image" src={portraitUrl} alt={PORTRAIT_ALT} />
    </div>
  )
}
