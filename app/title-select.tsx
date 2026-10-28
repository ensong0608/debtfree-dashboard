import { Children, cloneElement, isValidElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { capitalizeWords } from './display-label';

function labels(children: ReactNode, option = false): ReactNode {
  return Children.map(children, child => {
    if (typeof child === 'string') return option ? capitalizeWords(child) : child;
    if (!isValidElement<{ children?: ReactNode; label?: string }>(child)) return child;
    return cloneElement(child, {
      ...(child.props.label ? { label: capitalizeWords(child.props.label) } : {}),
      children: labels(child.props.children, option || child.type === 'option'),
    });
  });
}

/** Capitalize displayed choices while preserving stored values and brand casing. */
export default function TitleSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props}>{labels(children)}</select>;
}
