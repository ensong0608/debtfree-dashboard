"use client";
import {createPortal} from 'react-dom';
import styles from './action-confirmation.module.css';
export default function ActionConfirmation({title,message,confirmLabel,onConfirm,onCancel,tone='danger'}:{title:string;message:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;tone?:'danger'|'primary'}) {
 return createPortal(<div className={styles.backdrop}><section role="dialog" aria-modal="true" aria-label={title} className={styles.dialog}><header><span aria-hidden="true">{tone==='primary'?'✓':'!'}</span><h2>{title}</h2></header><p>{message}</p><footer><button data-dialog-close type="button" className="secondary" onClick={onCancel}>Cancel</button><button type="button" className={tone==='primary'?'primary':styles.confirm} onClick={onConfirm}>{confirmLabel}</button></footer></section></div>,document.body);
}
