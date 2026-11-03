import os
import re
import json
import shutil
import hashlib
from pathlib import Path

ROOT = Path(r"e:\AA Projects\New Full\CUET Mock")
DATASET_DIR = ROOT / "CUET_UG_2026_Papers"
CACHE_DIR = Path(r"C:\Users\rajpa\.gemini\antigravity\brain\31d2dc19-9304-4b00-84a1-25d9587a3456\scratch\images_cache")
SCRATCH = Path(r"C:\Users\rajpa\.gemini\antigravity\brain\31d2dc19-9304-4b00-84a1-25d9587a3456\scratch")
PAPERS_OUT_DIR = ROOT / "public" / "local-papers" / "papers"
ASSETS_OUT_DIR = ROOT / "public" / "local-papers" / "assets"
INDEX_FILE = ROOT / "src" / "data" / "local-papers" / "index.json"
KEYS_FILE = ROOT / "src" / "data" / "local-papers" / "keys.json"

MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12
}

SUBJ_INFO = {
    "Chemistry": {"slug": "chemistry", "name": "Chemistry", "code": "CHE", "duration": 45},
    "ComputerScience": {"slug": "computer-science", "name": "Computer Science", "code": "CS", "duration": 45},
    "English": {"slug": "english", "name": "English", "code": "ENG", "duration": 45},
    "GAT": {"slug": "general-test", "name": "General Test", "code": "GT", "duration": 60},
    "Geography": {"slug": "geography", "name": "Geography", "code": "GEO", "duration": 45},
    "History": {"slug": "history", "name": "History", "code": "HIS", "duration": 45},
    "Mathematics": {"slug": "mathematics", "name": "Mathematics", "code": "MAT", "duration": 45},
    "Physics": {"slug": "physics", "name": "Physics", "code": "PHY", "duration": 45}
}

from extract_options_smart import extract_options_smart

def sanitize_text(text):
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Remove control characters like \x00, \x01, etc.
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()

def split_blocks(text):
    text = sanitize_text(text)
    pat = re.compile(r"(?:^|\n)(?:#{1,6}\s*)?(?:Q\.?\s*|Question\s+)?(\d{1,2})\.\s+", re.I)
    matches = list(pat.finditer(text))
    seq = []
    expected = 1
    for m in matches:
        q_num = int(m.group(1))
        if q_num == expected:
            seq.append((q_num, m.start(), m.end()))
            expected += 1
        elif q_num == expected + 1:
            seq.append((q_num, m.start(), m.end()))
            expected = q_num + 1
        elif expected == 1 and q_num > 1 and q_num <= 5:
            seq.append((q_num, m.start(), m.end()))
            expected = q_num + 1
    
    blocks = {}
    for i, (q_num, start, h_end) in enumerate(seq):
        next_start = seq[i + 1][1] if i + 1 < len(seq) else len(text)
        blocks[q_num] = text[h_end:next_start].strip()
    return blocks

def extract_passages(text):
    text = sanitize_text(text)
    pat = re.compile(r"Passage\s+for\s+Questions?\s+(\d+)\s*[–\-\u2013\u2014to\s\ufffd]+\s*(\d+)\s*\n+(.*?)(?=\n(?:#{1,6}\s*)?(?:Q\.?\s*|Question\s+)?\d{1,2}\.\s+)", re.DOTALL | re.I)
    passages = []
    for i, m in enumerate(pat.finditer(text)):
        q_start = int(m.group(1))
        q_end = int(m.group(2))
        body = m.group(3).strip()
        lines = [l.strip() for l in body.split("\n") if l.strip()]
        title = "Reading passage"
        if lines:
            if "Read the" in lines[0] or "answer the questions" in lines[0]:
                if len(lines) > 1:
                    title = lines[1].replace("#", "").strip()
            else:
                title = lines[0].replace("#", "").strip()
        p_id = f"passage-{q_start}-{q_end}"
        passages.append({
            "id": p_id,
            "title": title[:100],
            "contentEn": body,
            "q_start": q_start,
            "q_end": q_end
        })
    return passages

def extract_answer_and_explanation(sol_chunk):
    sol_chunk = sanitize_text(sol_chunk)
    ans_m = re.search(r"(?:^|\n)(?:Correct\s+Answer|Correct\s+Option|Answer|Ans):\s*(.*?)(?=\n(?:#{1,6}\s*)?(?:Solution|Explanation):|\n\n|\Z)", sol_chunk, re.DOTALL | re.I)
    correct_ans = None
    if ans_m:
        raw_ans = ans_m.group(1).strip()
        m_let = re.search(r"(?:\(?([A-Da-d1-4])\)?|\b([A-Da-d])\b)", raw_ans)
        if m_let:
            val = (m_let.group(1) or m_let.group(2)).upper()
            if val in "1234":
                correct_ans = chr(64 + int(val))
            else:
                correct_ans = val

    sol_m = re.search(r"(?:^|\n)(?:#{1,6}\s*)?(?:Solution|Explanation):\s*(.*)", sol_chunk, re.DOTALL | re.I)
    explanation = sanitize_text(sol_m.group(1)) if sol_m else None
    
    if not correct_ans and explanation:
        m_exp_ans = re.search(r"(?:Hence|Therefore|Thus|So|correct\s+option\s+is|correct\s+answer\s+is)[\s\w,]*\b(?:option|answer)\s*(?:\(?([A-Da-d1-4])\)?|\b([A-Da-d])\b)", explanation, re.I)
        if m_exp_ans:
            val = (m_exp_ans.group(1) or m_exp_ans.group(2)).upper()
            if val in "1234":
                correct_ans = chr(64 + int(val))
            else:
                correct_ans = val
                
    return correct_ans, explanation

def strip_trailing_passage_header(text):
    p_m = re.search(r"\n\s*(?:#{1,6}\s*)?Passage\s+for\s+Questions?\s+\d+.*", text, re.DOTALL | re.I)
    if p_m:
        return text[:p_m.start()].strip()
    return text

def copy_image_asset(url, slug, filename):
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    cached_file = None
    for cand in CACHE_DIR.glob(f"{h}.*"):
        cached_file = cand
        break
        
    if not cached_file or not cached_file.exists():
        return None
        
    paper_asset_dir = ASSETS_OUT_DIR / slug
    paper_asset_dir.mkdir(parents=True, exist_ok=True)
    
    target_path = paper_asset_dir / filename
    shutil.copy2(cached_file, target_path)
    return f"/local-papers/assets/{slug}/{filename}"

def process_text_images(text, slug, q_num, prefix, question_assets):
    img_re = re.compile(r'<img\s+[^>]*src=["\']([^"\']+)["\'][^>]*>', re.I)
    img_count = 0
    
    def replacer(m):
        nonlocal img_count
        raw_url = m.group(1)
        if not raw_url.startswith("http"):
            return m.group(0)
            
        ext = "jpg"
        if ".png" in raw_url.lower(): ext = "png"
        elif ".jpeg" in raw_url.lower(): ext = "jpeg"
        elif ".webp" in raw_url.lower(): ext = "webp"
        
        img_count += 1
        asset_filename = f"q{q_num:02d}-{prefix}-{img_count}.{ext}"
        local_web_path = copy_image_asset(raw_url, slug, asset_filename)
        
        if local_web_path:
            asset_id = f"q{q_num:02d}-{prefix}-{img_count}"
            kind = "options" if "opt" in prefix else "figure"
            label = f"Figure {img_count} for question {q_num}"
            question_assets.append({
                "id": asset_id,
                "kind": kind,
                "path": local_web_path,
                "page": 1,
                "alt": label
            })
            return f'<img src="{local_web_path}" alt="{label}" />'
        return m.group(0)
        
    new_text = img_re.sub(replacer, text)
    return new_text

def build_all_papers():
    # 1. Reset index and keys from original backup
    bak_idx = INDEX_FILE.with_suffix(".json.bak")
    bak_keys = KEYS_FILE.with_suffix(".json.bak")
    if bak_idx.exists():
        index_data = json.loads(bak_idx.read_text(encoding="utf-8"))
    else:
        index_data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        bak_idx.write_text(json.dumps(index_data, indent=2), encoding="utf-8")
        
    if bak_keys.exists():
        keys_data = json.loads(bak_keys.read_text(encoding="utf-8"))
    else:
        keys_data = json.loads(KEYS_FILE.read_text(encoding="utf-8"))
        bak_keys.write_text(json.dumps(keys_data, indent=2), encoding="utf-8")
        
    existing_slugs = set(p["slug"] for p in index_data["papers"])
    print(f"Loaded existing index with {len(existing_slugs)} papers.")
    
    new_index_entries = []
    all_descriptions = set(p["metaDescription"] for p in index_data["papers"])
    
    processed_count = 0
    total_new_questions = 0
    total_new_keys = 0
    
    for subj_dir_name in SUBJ_INFO:
        s_dir = DATASET_DIR / subj_dir_name
        ocr_dir = DATASET_DIR / f"{subj_dir_name} 'OCR'"
        
        qp_pdfs = sorted(s_dir.glob("*_QP.pdf"))
        print(f"\nProcessing subject {subj_dir_name} ({len(qp_pdfs)} papers)...")
        
        for qp_pdf in qp_pdfs:
            stem = qp_pdf.name.replace("_QP.pdf", "")
            m = re.match(r"CUET_UG_2026_([^_]+)_([A-Za-z]+)(\d{1,2})_Shift(\d)", stem)
            if not m:
                print(f"  [ERROR] Cannot parse stem: {stem}")
                continue
                
            subj_raw, month_str, day_str, shift_num = m.groups()
            month_int = MONTHS[month_str]
            day_int = int(day_str)
            shift_int = int(shift_num)
            
            subj_meta = SUBJ_INFO[subj_dir_name]
            subj_slug = subj_meta["slug"]
            subj_name = subj_meta["name"]
            subj_code = subj_meta["code"]
            duration = subj_meta["duration"]
            
            date_iso = f"2026-{month_int:02d}-{day_int:02d}"
            date_label = f"{day_int} {month_str} 2026"
            shift_label = f"Shift {shift_int}"
            slug = f"{subj_slug}-{date_iso}-shift-{shift_int}"
            
            if slug in existing_slugs:
                print(f"  [SKIP] Slug already exists: {slug}")
                continue
                
            qp_md_path = ocr_dir / f"{stem}_QP.pdf_by_PaddleOCR-VL-1.6.md"
            sol_md_path = ocr_dir / f"{stem}_SOL.pdf_by_PaddleOCR-VL-1.6.md"
            
            qp_text = qp_md_path.read_text(encoding="utf-8", errors="ignore") if qp_md_path.exists() else ""
            if sol_md_path.exists():
                sol_text = sol_md_path.read_text(encoding="utf-8", errors="ignore")
            elif stem == "CUET_UG_2026_Physics_May18_Shift1":
                phys_sol_file = SCRATCH / "physics_may18_sol.txt"
                sol_text = phys_sol_file.read_text(encoding="utf-8", errors="ignore") if phys_sol_file.exists() else ""
            else:
                sol_text = ""
                
            qp_text = sanitize_text(qp_text)
            sol_text = sanitize_text(sol_text)
            
            # Extract passages
            passages = extract_passages(qp_text)
            if not passages and sol_text:
                passages = extract_passages(sol_text)
                
            clean_passages = []
            for p in passages:
                clean_passages.append({
                    "id": p["id"],
                    "title": p["title"],
                    "contentEn": p["contentEn"]
                })
                
            qp_blocks = split_blocks(qp_text)
            sol_blocks = split_blocks(sol_text)
            
            all_q_nums = sorted(set(list(qp_blocks.keys()) + list(sol_blocks.keys())))
            
            paper_questions = []
            paper_keys = {}
            paper_total_assets = 0
            image_q_count = 0
            
            for q_num in all_q_nums:
                qp_chunk = strip_trailing_passage_header(qp_blocks.get(q_num, ""))
                sol_chunk = sol_blocks.get(q_num, "")
                
                stem_txt, opts = extract_options_smart(qp_chunk)
                
                # Check if SOL has more/better options
                if len(opts) < 4 and sol_chunk:
                    sol_clean = strip_trailing_passage_header(sol_chunk)
                    ans_m = re.search(r"(?:^|\n)(?:Correct\s+Answer|Correct\s+Option|Answer|Ans):\s*(.*?)(?=\n(?:#{1,6}\s*)?(?:Solution|Explanation):|\n\n|\Z)", sol_clean, re.DOTALL | re.I)
                    sol_m = re.search(r"(?:^|\n)(?:#{1,6}\s*)?(?:Solution|Explanation):", sol_clean, re.I)
                    cut_pos = len(sol_clean)
                    if ans_m: cut_pos = min(cut_pos, ans_m.start())
                    if sol_m: cut_pos = min(cut_pos, sol_m.start())
                    sol_pre = sol_clean[:cut_pos].strip()
                    sol_stem, sol_opts = extract_options_smart(sol_pre)
                    if len(sol_opts) > len(opts):
                        stem_txt = sol_stem
                        opts = sol_opts
                        
                if len(opts) < 2:
                    continue
                    
                q_id = f"q{q_num:02d}"
                q_assets = []
                
                # Process images in stem
                stem_txt = sanitize_text(process_text_images(stem_txt, slug, q_num, "figure", q_assets))
                
                # Process images in options
                cleaned_opts = []
                for opt in opts:
                    opt_id = opt["id"]
                    opt_text = opt["text"]
                    opt_text = sanitize_text(process_text_images(opt_text, slug, q_num, f"opt-{opt_id}", q_assets))
                    cleaned_opts.append({"id": opt_id, "text": opt_text})
                    
                # Answer & explanation
                ans, exp = extract_answer_and_explanation(sol_chunk)
                if exp:
                    exp = sanitize_text(process_text_images(exp, slug, q_num, "exp", q_assets))
                    
                # Find passage
                p_id = None
                for p in passages:
                    if p["q_start"] <= q_num <= p["q_end"]:
                        p_id = p["id"]
                        break
                        
                if q_assets:
                    image_q_count += 1
                    paper_total_assets += len(q_assets)
                    
                # Check if this question is genuinely scorable:
                # ans must be present AND must match one of the option IDs!
                is_scorable = bool(ans and any(o["id"] == ans for o in cleaned_opts))
                
                q_obj = {
                    "id": q_id,
                    "sourceQuestionNo": q_num,
                    "stemEn": stem_txt,
                    "optionsEn": cleaned_opts,
                    "optionsAreImages": False,
                    "correctAnswer": None,
                    "explanationEn": None,
                    "passageId": p_id,
                    "reviewStatus": "keyed" if is_scorable else "pending",
                    "reviewFlags": [] if is_scorable else ["missing_answer_key"],
                    "sourcePages": [1],
                    "assets": q_assets
                }
                paper_questions.append(q_obj)
                
                if is_scorable:
                    paper_keys[q_id] = {
                        "a": ans,
                        "e": exp or f"The correct option is ({ans})."
                    }
                    
            if not paper_questions:
                print(f"  [ERROR] Zero questions parsed for {slug}!")
                continue
                
            q_count = len(paper_questions)
            s_count = len(paper_keys)
            source_q_count = max(50, q_count)
            if subj_slug == "general-test" and source_q_count < 60:
                source_q_count = 60
                
            # Write paper json
            paper_payload = {
                "exam": {
                    "id": f"local-{slug}",
                    "slug": slug,
                    "title": f"CUET UG {subj_name} {date_label} {shift_label} Previous Year Paper",
                    "subject": subj_name,
                    "subjectId": f"local-{subj_slug}",
                    "subjectCode": subj_code,
                    "year": 2026,
                    "examDate": date_iso,
                    "shift": shift_label,
                    "sourceFile": qp_pdf.name,
                    "sourceMethod": "PaddleOCR-VL 1.6 text and layout export; exact printed-page crops for diagrams and tables.",
                    "questionCount": q_count,
                    "sourceQuestionCount": source_q_count,
                    "publicationStatus": "published",
                    "reviewRequired": True,
                    "passages": clean_passages,
                    "questions": paper_questions
                }
            }
            
            paper_file_path = PAPERS_OUT_DIR / f"{slug}.json"
            paper_file_path.write_text(json.dumps(paper_payload, indent=2, ensure_ascii=False), encoding="utf-8")
            
            # Construct metaDescription
            meta_desc = f"Practise the CUET UG {subj_name} {date_label} {shift_label} as a timed, ranked mock: {q_count} questions, {s_count} scored, +5/-1 marking and a post-submit review."
            if meta_desc in all_descriptions:
                meta_desc = f"Practise the CUET UG {subj_name} {date_label} {shift_label} ({slug}) as a timed, ranked mock: {q_count} questions, {s_count} scored, +5/-1 marking and a post-submit review."
            all_descriptions.add(meta_desc)
            
            # Create index row
            index_entry = {
                "id": f"local-{slug}",
                "slug": slug,
                "title": f"CUET UG {subj_name} {date_label} {shift_label} Previous Year Paper",
                "metaDescription": meta_desc,
                "subject": {
                    "id": f"local-{subj_slug}",
                    "name": subj_name,
                    "slug": subj_slug,
                    "code": subj_code
                },
                "year": 2026,
                "date": date_iso,
                "dateLabel": date_label,
                "shift": shift_label,
                "durationMinutes": duration,
                "sourceFile": qp_pdf.name,
                "sourceMethod": "PaddleOCR-VL 1.6 text and layout export; exact printed-page crops for diagrams and tables.",
                "questionCount": q_count,
                "sourceQuestionCount": source_q_count,
                "scorableQuestionCount": s_count,
                "pendingReviewCount": q_count - s_count,
                "imageQuestionCount": image_q_count,
                "assetCount": paper_total_assets,
                "publicationStatus": "published",
                "reviewRequired": True
            }
            new_index_entries.append(index_entry)
            
            # Store in keys
            keys_data["papers"][slug] = paper_keys
            
            processed_count += 1
            total_new_questions += q_count
            total_new_keys += s_count
            
        print(f"Finished {subj_dir_name}: {processed_count} total papers processed so far.")
        
    print(f"\n==========================================")
    print(f"Total new papers processed: {len(new_index_entries)}")
    print(f"Total new questions: {total_new_questions}")
    print(f"Total new keys: {total_new_keys}")
    
    # Append new index entries to index_data
    index_data["papers"].extend(new_index_entries)
    
    # Save index.json and keys.json
    INDEX_FILE.write_text(json.dumps(index_data, indent=2, ensure_ascii=False), encoding="utf-8")
    KEYS_FILE.write_text(json.dumps(keys_data, indent=2, ensure_ascii=False), encoding="utf-8")
    
    print(f"Updated {INDEX_FILE} (total papers: {len(index_data['papers'])})")
    print(f"Updated {KEYS_FILE} (total papers in keys: {len(keys_data['papers'])})")

if __name__ == "__main__":
    build_all_papers()
