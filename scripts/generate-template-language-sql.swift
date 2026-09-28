import Foundation
import NaturalLanguage

struct LocaleCatalog: Decodable {
    struct Item: Decodable { let code: String }
    let languages: [Item]
}

struct Decision {
    let language: String
    let confidence: Double
    let reason: String
}

func canonical(_ raw: String) -> String {
    let normalized = raw.replacingOccurrences(of: "_", with: "-").lowercased()
    let base = normalized.split(separator: "-").first.map(String.init) ?? normalized
    if base == "en" { return "en" }
    if base == "zh" {
        let traditional = normalized.contains("hant") || ["zh-tw", "zh-hk", "zh-mo"].contains(normalized)
        return traditional ? "zh-hant" : "zh-hans"
    }
    return normalized
}

func contains(_ scalar: UnicodeScalar, _ ranges: [ClosedRange<UInt32>]) -> Bool {
    ranges.contains { $0.contains(scalar.value) }
}

func count(_ text: String, _ ranges: [ClosedRange<UInt32>]) -> Int {
    text.unicodeScalars.reduce(0) { $0 + (contains($1, ranges) ? 1 : 0) }
}

func decodeHex(_ value: Substring) -> String {
    var bytes: [UInt8] = []
    var index = value.startIndex
    while index < value.endIndex {
        let next = value.index(index, offsetBy: 2, limitedBy: value.endIndex) ?? value.endIndex
        if let byte = UInt8(value[index..<next], radix: 16) { bytes.append(byte) }
        index = next
    }
    return String(bytes: bytes, encoding: .utf8) ?? ""
}

let catalogData = try Data(contentsOf: URL(fileURLWithPath: "src/lib/templates/client-locales.json"))
let catalog = try JSONDecoder().decode(LocaleCatalog.self, from: catalogData)
let allowed = Set(catalog.languages.map { canonical($0.code) })

let recognizer = NLLanguageRecognizer()
func hypotheses(_ text: String) -> [(String, Double)] {
    recognizer.reset()
    recognizer.processString(text)
    return recognizer.languageHypotheses(withMaximum: 5)
        .map { (canonical($0.key.rawValue), $0.value) }
        .sorted { $0.1 > $1.1 }
}

let arabic: [ClosedRange<UInt32>] = [0x0600...0x06ff, 0x0750...0x077f, 0x08a0...0x08ff]
let persianDistinctive = CharacterSet(charactersIn: "پچژگکی")
let hebrew: [ClosedRange<UInt32>] = [0x0590...0x05ff]
let thai: [ClosedRange<UInt32>] = [0x0e00...0x0e7f]
let lao: [ClosedRange<UInt32>] = [0x0e80...0x0eff]
let khmer: [ClosedRange<UInt32>] = [0x1780...0x17ff]
let myanmar: [ClosedRange<UInt32>] = [0x1000...0x109f]
let hangul: [ClosedRange<UInt32>] = [0x1100...0x11ff, 0x3130...0x318f, 0xac00...0xd7af]
let kana: [ClosedRange<UInt32>] = [0x3040...0x30ff, 0x31f0...0x31ff]
let han: [ClosedRange<UInt32>] = [0x3400...0x4dbf, 0x4e00...0x9fff, 0xf900...0xfaff]
let cyrillic: [ClosedRange<UInt32>] = [0x0400...0x052f]
let greek: [ClosedRange<UInt32>] = [0x0370...0x03ff]
let devanagari: [ClosedRange<UInt32>] = [0x0900...0x097f]
let bengali: [ClosedRange<UInt32>] = [0x0980...0x09ff]
let gurmukhi: [ClosedRange<UInt32>] = [0x0a00...0x0a7f]
let gujarati: [ClosedRange<UInt32>] = [0x0a80...0x0aff]
let odia: [ClosedRange<UInt32>] = [0x0b00...0x0b7f]
let tamil: [ClosedRange<UInt32>] = [0x0b80...0x0bff]
let telugu: [ClosedRange<UInt32>] = [0x0c00...0x0c7f]
let kannada: [ClosedRange<UInt32>] = [0x0c80...0x0cff]
let malayalam: [ClosedRange<UInt32>] = [0x0d00...0x0d7f]
let sinhala: [ClosedRange<UInt32>] = [0x0d80...0x0dff]
let ethiopic: [ClosedRange<UInt32>] = [0x1200...0x137f]
let armenian: [ClosedRange<UInt32>] = [0x0530...0x058f]
let georgian: [ClosedRange<UInt32>] = [0x10a0...0x10ff, 0x2d00...0x2d2f]
let vietnameseDistinctive = CharacterSet(charactersIn: "ĂăÂâĐđÊêÔôƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ")

func hasAny(_ text: String, _ values: [String]) -> Bool {
    values.contains { text.contains($0) }
}

func fixedScript(_ text: String, ranges: [ClosedRange<UInt32>], language: String) -> Decision? {
    count(text, ranges) > 0 ? Decision(language: language, confidence: 1, reason: "unicode-script") : nil
}

func classify(_ text: String, current: String) -> Decision {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return Decision(language: current, confidence: 0, reason: "empty") }
    if trimmed.unicodeScalars.contains(where: persianDistinctive.contains) {
        return Decision(language: "fa", confidence: 1, reason: "persian-character")
    }
    if let value = fixedScript(trimmed, ranges: arabic, language: "ar") { return value }
    if let value = fixedScript(trimmed, ranges: hebrew, language: "he") { return value }
    if let value = fixedScript(trimmed, ranges: thai, language: "th") { return value }
    if let value = fixedScript(trimmed, ranges: lao, language: "lo") { return value }
    if let value = fixedScript(trimmed, ranges: khmer, language: "km") { return value }
    if let value = fixedScript(trimmed, ranges: myanmar, language: "my") { return value }
    if let value = fixedScript(trimmed, ranges: hangul, language: "ko") { return value }
    if let value = fixedScript(trimmed, ranges: kana, language: "ja") { return value }
    if let value = fixedScript(trimmed, ranges: hebrew, language: "he") { return value }
    if let value = fixedScript(trimmed, ranges: greek, language: "el") { return value }
    if let value = fixedScript(trimmed, ranges: bengali, language: "bn") { return value }
    if let value = fixedScript(trimmed, ranges: gurmukhi, language: "pa") { return value }
    if let value = fixedScript(trimmed, ranges: gujarati, language: "gu") { return value }
    if let value = fixedScript(trimmed, ranges: odia, language: "or") { return value }
    if let value = fixedScript(trimmed, ranges: tamil, language: "ta") { return value }
    if let value = fixedScript(trimmed, ranges: telugu, language: "te") { return value }
    if let value = fixedScript(trimmed, ranges: kannada, language: "kn") { return value }
    if let value = fixedScript(trimmed, ranges: malayalam, language: "ml") { return value }
    if let value = fixedScript(trimmed, ranges: sinhala, language: "si") { return value }
    if let value = fixedScript(trimmed, ranges: ethiopic, language: "am") { return value }
    if let value = fixedScript(trimmed, ranges: armenian, language: "hy") { return value }
    if let value = fixedScript(trimmed, ranges: georgian, language: "ka") { return value }

    let guesses = hypotheses(trimmed).filter { allowed.contains($0.0) }
    if count(trimmed, cyrillic) > 0 {
        return Decision(language: "ru", confidence: 0.9, reason: "cyrillic")
    }
    if count(trimmed, devanagari) > 0, let best = guesses.first, best.1 >= 0.45 {
        return Decision(language: best.0, confidence: best.1, reason: "devanagari+recognizer")
    }
    if count(trimmed, han) > 0 {
        if hasAny(trimmed, ["駅", "配達完了", "株式会社", "丁目"]) {
            return Decision(language: "ja", confidence: 0.98, reason: "japanese-marker")
        }
        let simplified = trimmed.applyingTransform(StringTransform("Traditional-Simplified"), reverse: false) ?? trimmed
        let traditional = trimmed.applyingTransform(StringTransform("Simplified-Traditional"), reverse: false) ?? trimmed
        if simplified != trimmed && traditional == trimmed {
            return Decision(language: "zh-hant", confidence: 0.98, reason: "traditional-character")
        }
        return Decision(language: "zh-hans", confidence: 0.9, reason: "han-default-simplified")
    }
    if trimmed.unicodeScalars.contains(where: vietnameseDistinctive.contains) {
        return Decision(language: "vi", confidence: 0.98, reason: "vietnamese-diacritic")
    }

    let latin = trimmed.lowercased()
    if hasAny(latin, ["sdn bhd", "kawalan", "cyberjaya"]) {
        return Decision(language: "ms", confidence: 0.98, reason: "malay-marker")
    }
    if hasAny(latin, ["absen", "daftar", "hadir", "tidak ada", "wong ngapak", "laboratorium", "pramusaji", "dinas lingkungan", "kehutanan", "kabupaten", "kecamatan", "kelurahan", "kota jakarta", "jawa barat", "bengkel", "pemburu", "pejuang rupiah", "serah terima", "rumah sakit", "kuli sawah", "udah makan", "hariyono", "nurhayati", "suhendar", "jumat", "sanitasi", "transportasi", "apartemen", "panggilan", "indonesia"]) {
        return Decision(language: "id", confidence: 0.96, reason: "indonesian-marker")
    }
    if hasAny(latin, ["seguridad", "equipo básico", "comisión federal", "armas de fuego", "mesa de trabajo", "consejo comunitario", "defensa", "san quintín", "viajeros", "recoleta"]) {
        return Decision(language: "es", confidence: 0.97, reason: "spanish-marker")
    }
    if hasAny(latin, ["segurança", "serviço", "reprodução", "equipe malassombrada", "horas no ar"]) {
        return Decision(language: "pt", confidence: 0.97, reason: "portuguese-marker")
    }
    if hasAny(latin, ["retraité", "sécurité privée"]) {
        return Decision(language: "fr", confidence: 0.97, reason: "french-marker")
    }
    if hasAny(latin, ["mühendislik", "güvenlik", "çetinkaya", "yilmaz"]) {
        return Decision(language: "tr", confidence: 0.97, reason: "turkish-marker")
    }
    return Decision(language: current, confidence: guesses.first?.1 ?? 0, reason: "insufficient-confidence")
}

guard CommandLine.arguments.count == 2 else {
    fputs("usage: generate-template-language-sql.swift OUTPUT_PATH\n", stderr)
    exit(2)
}

var assignments: [String: [(id: String, reason: String)]] = [:]
var totals: [String: Int] = [:]
var samples: [String: [String]] = [:]
var retained = 0
for line in String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8)?.split(separator: "\n") ?? [] {
    let fields = line.split(separator: "\t", omittingEmptySubsequences: false)
    guard fields.count == 3 else { continue }
    let id = String(fields[0])
    let current = canonical(String(fields[1]))
    let text = decodeHex(fields[2])
    let decision = classify(text, current: current)
    totals[decision.language, default: 0] += 1
    if samples[decision.language, default: []].count < 8 {
        samples[decision.language, default: []].append(text.replacingOccurrences(of: "\n", with: " "))
    }
    if decision.language == current {
        retained += 1
    } else {
        assignments[decision.language, default: []].append((id, decision.reason))
    }
}

var sql = """
-- Generated from the current watermark_name + company_name values.
-- High-confidence Unicode scripts are classified directly; ambiguous short text keeps its existing language.
START TRANSACTION;

"""
for language in assignments.keys.sorted() {
    let rows = assignments[language]!.sorted { $0.id < $1.id }
    sql += "-- \(language): \(rows.count) records\n"
    sql += "UPDATE watermarks_share_links SET language='\(language)' WHERE language='en' AND id IN (\n"
    sql += rows.map { "  '\($0.id)'" }.joined(separator: ",\n")
    sql += "\n);\n\n"
}
sql += "COMMIT;\n"
try sql.write(toFile: CommandLine.arguments[1], atomically: true, encoding: .utf8)

print("classified totals:")
for language in totals.keys.sorted() { print("\(language)\t\(totals[language]!)") }
print("updates\t\(assignments.values.reduce(0) { $0 + $1.count })")
print("retained\t\(retained)")
print("samples:")
for language in samples.keys.sorted() {
    print("[\(language)] \(samples[language]!.joined(separator: " | "))")
}
