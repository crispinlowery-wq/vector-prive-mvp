import type { RequestStatus } from "@/lib/data";
const labels:Record<RequestStatus,string>={new:"New",triaged:"Triaged",in_progress:"In progress",awaiting_approval:"Approval needed",approved:"Approved",confirmed:"Confirmed"};
export function Status({value}:{value:RequestStatus}){return <span className={`status ${value}`}>{labels[value]}</span>}
