import Link from "next/link";
import { viMessages } from "@/i18n/vi";

export default function NotFound() {
  return (
    <div className="system-state">
      <div className="brand-mark">ㅎ</div>
      <strong>{viMessages.system.notFound}</strong>
      <span>{viMessages.system.notFoundBody}</span>
      <Link className="primary-button" href="/">
        {viMessages.system.home}
      </Link>
    </div>
  );
}
