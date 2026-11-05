import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')
c = sqlite3.connect('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite')

print("=== CHEMISTRY 2025-05-23-SHIFT-2 ===")
m = c.execute("SELECT id, current_version_id FROM mock_tests WHERE slug = ?", ('chemistry-2025-05-23-shift-2',)).fetchone()
if m:
    rows = c.execute("""
        SELECT mq.position, q.text, q.options, q.correct_option, q.passage_id, p.body
        FROM mock_questions mq
        JOIN questions q ON mq.question_id = q.id
        LEFT JOIN passages p ON q.passage_id = p.id
        WHERE mq.version_id = ?
        ORDER BY mq.position
    """, (m[1],)).fetchall()
    for r in rows:
        pos = r[0]
        if pos in (26, 27, 28, 36, 37, 38, 39, 40, 41, 42, 43):
            t = r[1].replace('\n', ' ')[:90]
            print(f"Pos {pos}: {t}")
            print(f"   Opts: {r[2][:90]}")
            print(f"   Key: {r[3]}")
            if r[5]:
                print(f"   Passage end: {r[5][-80:].replace(chr(10), ' ')}")

print("\n=== BIOLOGY 2025-05-20-SHIFT-1 ===")
m2 = c.execute("SELECT id, current_version_id FROM mock_tests WHERE slug = ?", ('biology-2025-05-20-shift-1',)).fetchone()
if m2:
    rows2 = c.execute("""
        SELECT mq.position, q.text, q.options, q.correct_option
        FROM mock_questions mq
        JOIN questions q ON mq.question_id = q.id
        WHERE mq.version_id = ? AND mq.position = 39
    """, (m2[1],)).fetchall()
    for r in rows2:
        t = r[1].replace('\n', ' ')[:120]
        print(f"Pos {r[0]}: {t}")
        print(f"   Opts: {r[2]}")
        print(f"   Key: {r[3]}")

print("\n--- Chemistry questions in current version ---")
rows_all = c.execute("""
    SELECT mq.position, q.id, q.text, q.image_url
    FROM mock_questions mq JOIN questions q ON mq.question_id = q.id
    WHERE mq.version_id = ?
    ORDER BY mq.position
""", (m[1],)).fetchall()
for r in rows_all:
    if "Match" in r[2] or "Rosenmund" in r[2]:
        print(f"Pos {r[0]} (QID {r[1]}): {r[2][:80].replace(chr(10), ' ')} | img={r[3]}")
