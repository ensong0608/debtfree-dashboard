import OutlineIcon from './outline-icon';
import { institutionPresentation } from './institutions';
import styles from './institution-icon.module.css';

/** Issuer/lender identity only; never use this for merchant or category identity. */
export default function InstitutionIcon({ institutionKey, debtType }: { institutionKey?: unknown; debtType: string }) {
  const { label, icon } = institutionPresentation(institutionKey, debtType);
  return <span className={styles.tile} role="img" aria-label={label && label !== 'Other' ? `${label} (${debtType})` : debtType}>
    <OutlineIcon name={icon}/>
  </span>;
}
