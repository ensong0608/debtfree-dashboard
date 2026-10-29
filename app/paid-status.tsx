import OutlineIcon from './outline-icon';
export default function PaidStatus({label='Paid'}:{label?:string}) {
  return <span className="paid-status"><span aria-hidden="true"><OutlineIcon name="check"/></span>{label}</span>;
}
