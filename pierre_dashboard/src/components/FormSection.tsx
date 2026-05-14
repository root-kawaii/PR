import type { ReactNode } from "react";
import { ui } from "./ui-classes";

interface FormSectionProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <section className={className}>
      <h3 className={ui.sectionTitle}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default FormSection;
