import type { ReactNode } from 'react';
import { joinClasses, ui } from './ui-classes';

type WithClassName = {
  className?: string;
};

type PageHeaderProps = WithClassName & {
  title: string;
  description?: string;
  action?: ReactNode;
};

type SectionCardProps = WithClassName & {
  children: ReactNode;
};

type EmptyStateProps = WithClassName & {
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={joinClasses(ui.pageHeader, className)}>
      <div className="space-y-1">
        <h1 className={ui.pageTitle}>{title}</h1>
        {description ? <p className={ui.pageDescription}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionCard({ children, className }: SectionCardProps) {
  return <div className={joinClasses(ui.card, className)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={joinClasses(ui.emptyState, className)}>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-pretty text-gray-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
