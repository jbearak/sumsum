// Minimal accessibility helper for driving Zen without screen recording.
// usage: ax dump <appName> [maxDepth] [filter]
//        ax press <appName> <substring>      (press first element whose label contains substring)
//        ax click <x> <y>
//        ax setvalue <appName> <substring> <value>
import Cocoa
import ApplicationServices

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    let err = AXUIElementCopyAttributeValue(e, name as CFString, &v)
    return err == .success ? v : nil
}
func str(_ e: AXUIElement, _ name: String) -> String {
    guard let v = attr(e, name) else { return "" }
    if let s = v as? String { return s }
    if let n = v as? NSNumber { return n.stringValue }
    return ""
}
func point(_ e: AXUIElement) -> CGPoint? {
    guard let v = attr(e, kAXPositionAttribute) else { return nil }
    var p = CGPoint.zero
    if AXValueGetValue(v as! AXValue, .cgPoint, &p) { return p }
    return nil
}
func size(_ e: AXUIElement) -> CGSize? {
    guard let v = attr(e, kAXSizeAttribute) else { return nil }
    var s = CGSize.zero
    if AXValueGetValue(v as! AXValue, .cgSize, &s) { return s }
    return nil
}
func children(_ e: AXUIElement) -> [AXUIElement] {
    return (attr(e, kAXChildrenAttribute) as? [AXUIElement]) ?? []
}
func label(_ e: AXUIElement) -> String {
    let role = str(e, kAXRoleAttribute), sub = str(e, kAXSubroleAttribute)
    let t = str(e, kAXTitleAttribute), d = str(e, kAXDescriptionAttribute), v = str(e, kAXValueAttribute)
    var geo = ""
    if let p = point(e), let s = size(e) { geo = String(format: "@%.0f,%.0f %.0fx%.0f", p.x, p.y, s.width, s.height) }
    return "\(role)\(sub.isEmpty ? "" : "/" + sub) t=\(t) d=\(d) v=\(v.prefix(160)) \(geo)"
}
func appElement(_ name: String) -> AXUIElement? {
    for app in NSWorkspace.shared.runningApplications where (app.localizedName ?? "").lowercased() == name.lowercased() {
        return AXUIElementCreateApplication(app.processIdentifier)
    }
    return nil
}
func walk(_ e: AXUIElement, _ depth: Int, _ maxDepth: Int, _ filter: String, _ out: inout [String]) {
    let l = label(e)
    if filter.isEmpty || l.lowercased().contains(filter.lowercased()) { out.append(String(repeating: " ", count: depth) + l) }
    if depth >= maxDepth { return }
    for c in children(e) { walk(c, depth + 1, maxDepth, filter, &out) }
}
func find(_ e: AXUIElement, _ sub: String, _ depth: Int = 0) -> AXUIElement? {
    let t = str(e, kAXTitleAttribute), d = str(e, kAXDescriptionAttribute), v = str(e, kAXValueAttribute)
    if (t + "\u{1}" + d + "\u{1}" + v).lowercased().contains(sub.lowercased()) && depth > 0 { return e }
    if depth > 60 { return nil }
    for c in children(e) { if let f = find(c, sub, depth + 1) { return f } }
    return nil
}

let args = CommandLine.arguments
guard args.count >= 2 else { print("usage"); exit(2) }
switch args[1] {
case "dump":
    guard let app = appElement(args[2]) else { print("no app"); exit(1) }
    let maxDepth = args.count > 3 ? Int(args[3]) ?? 40 : 40
    let filter = args.count > 4 ? args[4] : ""
    var out: [String] = []
    walk(app, 0, maxDepth, filter, &out)
    print(out.joined(separator: "\n"))
case "press":
    guard let app = appElement(args[2]), let e = find(app, args[3]) else { print("not found"); exit(1) }
    print("pressing: " + label(e))
    let r = AXUIElementPerformAction(e, kAXPressAction as CFString)
    print("result \(r.rawValue)")
case "click":
    let p = CGPoint(x: Double(args[2])!, y: Double(args[3])!)
    let src = CGEventSource(stateID: .hidSystemState)
    for t in [CGEventType.leftMouseDown, .leftMouseUp] {
        CGEvent(mouseEventSource: src, mouseType: t, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
        usleep(60000)
    }
    print("clicked")
case "setvalue":
    guard let app = appElement(args[2]), let e = find(app, args[3]) else { print("not found"); exit(1) }
    let r = AXUIElementSetAttributeValue(e, kAXValueAttribute as CFString, args[4] as CFString)
    print("set result \(r.rawValue)")
default:
    print("unknown")
}
