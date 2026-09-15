// Matches TemplateReportReason and zh-Hans/Localizable.strings in the iOS client.
const labels = new Map([
  ["intellectual_property", "侵犯知识产权"],
  ["fraud_deceptive", "欺诈或误导行为"],
  ["impersonation_unauthorized", "冒用身份或未经授权使用"],
  ["privacy_violation", "侵犯隐私"],
]);

export function reportReasonLabel(reason?: string) {
  return reason ? (labels.get(reason) ?? `其他：${reason}`) : "未填写";
}
