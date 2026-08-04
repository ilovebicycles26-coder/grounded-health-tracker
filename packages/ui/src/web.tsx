import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly pending?: boolean;
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
}

export function Button({
  children,
  disabled,
  pending = false,
  type = 'button',
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={pending}
      className={['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled ?? pending}
      type={type}
    >
      {pending ? 'Please wait…' : children}
    </button>
  );
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <section {...props} className={['ui-card', className].filter(Boolean).join(' ')}>
      {children}
    </section>
  );
}

interface FieldDetails {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

function useFieldIds(id: string | undefined, hint: string | undefined, error: string | undefined) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return {
    inputId,
    hintId: hint ? `${inputId}-hint` : undefined,
    errorId: error ? `${inputId}-error` : undefined,
  };
}

function describedBy(hintId: string | undefined, errorId: string | undefined): string | undefined {
  const ids = [hintId, errorId].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>, FieldDetails {}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { error, hint, id, label, className, ...props },
  ref,
) {
  const ids = useFieldIds(id, hint, error);
  return (
    <div className="ui-field">
      <label htmlFor={ids.inputId}>{label}</label>
      {hint ? <p id={ids.hintId}>{hint}</p> : null}
      <input
        {...props}
        aria-describedby={describedBy(ids.hintId, ids.errorId)}
        aria-invalid={Boolean(error)}
        className={className}
        id={ids.inputId}
        ref={ref}
      />
      {error ? (
        <p className="ui-field__error" id={ids.errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>, FieldDetails {
  readonly children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { children, error, hint, id, label, className, ...props },
  ref,
) {
  const ids = useFieldIds(id, hint, error);
  return (
    <div className="ui-field">
      <label htmlFor={ids.inputId}>{label}</label>
      {hint ? <p id={ids.hintId}>{hint}</p> : null}
      <select
        {...props}
        aria-describedby={describedBy(ids.hintId, ids.errorId)}
        aria-invalid={Boolean(error)}
        className={className}
        id={ids.inputId}
        ref={ref}
      >
        {children}
      </select>
      {error ? (
        <p className="ui-field__error" id={ids.errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'children' | 'type'
> {
  readonly label: string;
  readonly hint?: string | undefined;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { hint, id, label, ...props },
  ref,
) {
  const ids = useFieldIds(id, hint, undefined);
  return (
    <div className="ui-checkbox">
      <input {...props} aria-describedby={ids.hintId} id={ids.inputId} ref={ref} type="checkbox" />
      <div>
        <label htmlFor={ids.inputId}>{label}</label>
        {hint ? <p id={ids.hintId}>{hint}</p> : null}
      </div>
    </div>
  );
});

export function VisuallyHidden({ children }: { readonly children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
