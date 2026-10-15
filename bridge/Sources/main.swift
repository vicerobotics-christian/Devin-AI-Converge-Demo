import Foundation
import FoundationModels
import Network

// Local-only bridge from the web app to Apple's on-device Foundation Model.
// Listens on 127.0.0.1 so nothing is reachable from the network.

@Generable
struct SearchIntent: Codable {
    @Guide(description: "Artist disciplines the user wants. Use only: music, visual, photo, film, dance, writing, theater, design.")
    var disciplines: [String]
    @Guide(description: "Up to 6 short lowercase search keywords such as genres, styles, instruments or roles, e.g. reggaeton, muralist, jazz, cinematographer. If the user describes a mood, include exactly one of: upbeat, mellow, heavy, romantic.")
    var keywords: [String]
    @Guide(description: "Miami connection requested: 'born', 'based', or 'any'.")
    var miami: String
    @Guide(description: "One short sentence restating what the user is looking for.")
    var summary: String
}

struct Candidate: Codable { let name: String; let tagline: String }
struct ReplyRequest: Codable { let query: String; let candidates: [Candidate] }
struct ReplyResponse: Codable { let reply: String }
struct IntentRequest: Codable { let query: String }

let allowedOrigins: Set<String> = {
    let env = ProcessInfo.processInfo.environment["CONVERGE_ORIGINS"] ?? ""
    return Set(["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"] + env.split(separator: ",").map(String.init))
}()

func intent(for query: String) async throws -> SearchIntent {
    let session = LanguageModelSession(instructions: """
    You turn a request from someone looking for Miami artists to collaborate with into structured search filters.
    Only extract what the user asked for. Never invent names.
    """)
    return try await session.respond(to: query, generating: SearchIntent.self).content
}

func reply(for req: ReplyRequest) async throws -> String {
    let list = req.candidates.prefix(6).map { "- \($0.name): \($0.tagline)" }.joined(separator: "\n")
    let session = LanguageModelSession(instructions: """
    You are the matchmaker in an app that connects Miami artists. Reply in at most two friendly sentences.
    Mention only artists from the provided list, and only facts stated in their descriptions.
    """)
    return try await session.respond(to: "Request: \(req.query)\nMatches:\n\(list)").content
}

func response(_ status: String, _ body: Data, origin: String?) -> Data {
    var head = "HTTP/1.1 \(status)\r\nContent-Type: application/json\r\nContent-Length: \(body.count)\r\nConnection: close\r\n"
    if let origin, allowedOrigins.contains(origin) {
        head += "Access-Control-Allow-Origin: \(origin)\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\nVary: Origin\r\n"
    }
    return Data((head + "\r\n").utf8) + body
}

func json<T: Encodable>(_ value: T) -> Data { (try? JSONEncoder().encode(value)) ?? Data("{}".utf8) }

func handle(_ raw: Data) async -> Data {
    guard let split = raw.range(of: Data("\r\n\r\n".utf8)),
          let head = String(data: raw[..<split.lowerBound], encoding: .utf8) else {
        return response("400 Bad Request", Data(), origin: nil)
    }
    let lines = head.components(separatedBy: "\r\n")
    let parts = lines.first?.split(separator: " ") ?? []
    let method = parts.first.map(String.init) ?? ""
    let path = parts.count > 1 ? String(parts[1]) : ""
    let origin = lines.first { $0.lowercased().hasPrefix("origin:") }.map { $0.dropFirst(7).trimmingCharacters(in: .whitespaces) }
    let body = raw[split.upperBound...]

    if method == "OPTIONS" { return response("204 No Content", Data(), origin: origin) }
    do {
        switch (method, path) {
        case ("GET", "/health"):
            let ok = SystemLanguageModel.default.availability == .available
            return response("200 OK", json(["model": ok ? "available" : "unavailable"]), origin: origin)
        case ("POST", "/intent"):
            let req = try JSONDecoder().decode(IntentRequest.self, from: body)
            return response("200 OK", json(try await intent(for: String(req.query.prefix(500)))), origin: origin)
        case ("POST", "/reply"):
            let req = try JSONDecoder().decode(ReplyRequest.self, from: body)
            return response("200 OK", json(ReplyResponse(reply: try await reply(for: req))), origin: origin)
        default:
            return response("404 Not Found", json(["error": "not found"]), origin: origin)
        }
    } catch {
        return response("500 Internal Server Error", json(["error": "\(error)"]), origin: origin)
    }
}

func receiveAll(_ conn: NWConnection, buffer: Data = Data()) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { chunk, _, done, error in
        var data = buffer
        if let chunk { data.append(chunk) }
        if let split = data.range(of: Data("\r\n\r\n".utf8)),
           let head = String(data: data[..<split.lowerBound], encoding: .utf8) {
            let length = head.components(separatedBy: "\r\n")
                .first { $0.lowercased().hasPrefix("content-length:") }
                .flatMap { Int($0.dropFirst(15).trimmingCharacters(in: .whitespaces)) } ?? 0
            if data.count - split.upperBound >= length || done {
                Task {
                    let out = await handle(data)
                    conn.send(content: out, completion: .contentProcessed { _ in conn.cancel() })
                }
                return
            }
        }
        if done || error != nil || data.count > 1_000_000 { conn.cancel(); return }
        receiveAll(conn, buffer: data)
    }
}

let port = NWEndpoint.Port(rawValue: UInt16(ProcessInfo.processInfo.environment["PORT"] ?? "8787") ?? 8787)!
let params = NWParameters.tcp
params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: port)
let listener = try NWListener(using: params)
listener.newConnectionHandler = { conn in
    conn.start(queue: .global())
    receiveAll(conn)
}
listener.stateUpdateHandler = { state in
    if case .ready = state { print("Converge bridge on http://127.0.0.1:\(port) — model: \(SystemLanguageModel.default.availability)") }
    if case .failed(let e) = state { print("listener failed: \(e)"); exit(1) }
}
listener.start(queue: .main)
dispatchMain()
