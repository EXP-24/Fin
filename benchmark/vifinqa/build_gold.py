#!/usr/bin/env python3
"""Write the hand-verified gold set for the ViFinQA subset (13 questions).

Gold answers were read by hand from the OCR reports (not produced by any model).
Each item records the report it comes from and a quote, so it can be re-checked.
``gold_alternatives`` is a list of acceptable number sets: an answer is correct if
ALL numbers of ANY one set appear in it (after Vietnamese number canonicalisation),
which covers the same value written in different units (đồng / triệu / tỷ).

Question wording is verbatim from ViFinQA ``questions.jsonl`` (ids kept).
"""

import json
from pathlib import Path

G = [
 dict(id=134, ticker="VNM", report="VNM_2025_consolidated.md",
      question="Số dư quỹ khen thưởng và phúc lợi của CTCP Sữa Việt Nam cuối năm 2025 là bao nhiêu tỷ đồng?",
      answer="953,05 tỷ đồng (953.046.624.309 đồng)", alts=[["953046624309"], ["953.05"], ["953"]],
      evidence="Thuyết minh V.20: 'Số dư cuối năm | 953.046.624.309' (hợp nhất)"),
 dict(id=204, ticker="VNM", report="VNM_2020_consolidated.md",
      question="Số cổ phiếu phổ thông bình quân gia quyền của Công ty Cổ phần Sữa Việt Nam (VNM) trong năm 2020 là bao nhiêu cổ phiếu?",
      answer="2.089.651.574 cổ phiếu", alts=[["2089651574"]],
      evidence="Thuyết minh EPS (b): 'Số lượng bình quân gia quyền ... | 2.089.651.574'"),
 dict(id=210, ticker="VNM", report="VNM_2018_consolidated.md",
      question="Công ty Cổ phần Sữa Việt Nam (VNM) có số lượng cổ phiếu phổ thông bình quân gia quyền trong năm 2018 là bao nhiêu cổ phiếu?",
      answer="1.741.476.075 cổ phiếu", alts=[["1741476075"]],
      evidence="Thuyết minh EPS (b): 'Số lượng bình quân gia quyền ... | 1.741.476.075'"),
 dict(id=254, ticker="VNM", report="VNM_2015_consolidated.md",
      question="Số dư thuế thu nhập doanh nghiệp của VNM đến ngày 31/12/2015 là bao nhiêu tỷ đồng?",
      answer="62,79 tỷ đồng (62.789.950.010 đồng)", alts=[["62789950010"], ["62.79"], ["62.8"]],
      evidence="Thuyết minh 21 'Thuế phải nộp': TNDN, cột 31/12/2015 = 62.789.950.010 (hợp nhất; giả định phạm vi hợp nhất)"),
 dict(id=266, ticker="VNM", report="VNM_2023_consolidated.md",
      question="Tổng thù lao Ông Nguyễn Hạnh Phúc – Chủ tịch của VNM trong năm 2023 là bao nhiêu triệu đồng?",
      answer="3.123 triệu đồng", alts=[["3123"]],
      evidence="Thuyết minh bên liên quan: 'Ông Nguyễn Hạnh Phúc – Chủ tịch | 3.123 (2023) | 1.720 (2022)'"),
 dict(id=277, ticker="VNM", report="VNM_2022_consolidated.md",
      question="Lợi nhuận thuần thuộc về cổ đông phổ thông trước khi trích quỹ khen thưởng và phúc lợi của CTCP Sữa Việt Nam (VNM) năm 2022 là bao nhiêu trăm tỷ đồng?",
      answer="85,16 trăm tỷ đồng (8.516.023.694.342 đồng)", alts=[["8516023694342"], ["85.16"], ["85.2"]],
      evidence="Thuyết minh EPS (a), cột 2022: 8.516.023.694.342"),
 dict(id=596, ticker="VNM", report="VNM_2017_separate.md|VNM_2024_separate.md",
      question="Tính tỷ lệ tăng trưởng (%) giá trị đầu tư (Giá gốc) vào Công ty Cổ phần APIS của công ty mẹ CTCP Sữa Việt Nam (VNM) từ cuối năm 2017 đến hết năm 2024.",
      answer="151,23% (từ 8.100.000.000 đồng lên 20.350.000.000 đồng)", alts=[["151.23"], ["151.2"]],
      evidence="Báo cáo riêng 2017: APIS giá gốc 8.100.000.000 (31/12/2017); báo cáo riêng 2024: 20.350.000.000 (31/12/2024); (20,35-8,1)/8,1"),
 dict(id=710, ticker="VNM", report="VNM_2022_separate.md",
      question="Tỷ lệ nợ ngắn hạn trên vốn chủ sở hữu của công ty mẹ CTCP Sữa Việt Nam năm 2022 là bao nhiêu %?",
      answer="47,89% (13.895.815.212.897 / 29.013.924.943.549)", alts=[["47.89"], ["47.9"]],
      evidence="Bảng CĐKT riêng 31/12/2022: Nợ ngắn hạn 13.895.815.212.897; Vốn chủ sở hữu 29.013.924.943.549"),
 dict(id=33, ticker="MBB", report="MBB_2020_consolidated.md",
      question="Số dư dự phòng rủi ro cho vay khách hàng của Ngân hàng TMCP Quân đội là bao nhiêu triệu đồng vào cuối năm 2020?",
      answer="4.354.219 triệu đồng", alts=[["4354219"]],
      evidence="Thuyết minh: 'Số dư tại ngày 31 tháng 12 năm 2020 | ... | 4.354.219'"),
 dict(id=272, ticker="MBB", report="MBB_2020_separate.md",
      question="Tổng tài sản đến ngày 31/12/2020 của công ty mẹ Ngân hàng TMCP Quân đội là bao nhiêu triệu đồng?",
      answer="482.483.609 triệu đồng", alts=[["482483609"]],
      evidence="Dòng 'Tổng tài sản' của bảng CĐKT bị mất khi OCR; số liệu còn ở bảng thanh khoản/lãi suất: 'Tổng tài sản | ... | 482.483.609' (ca OCR khó)"),
 dict(id=97, ticker="HPG", report="HPG_2023_consolidated.md",
      question="Tỷ lệ sở hữu Công ty CP Gang thép Hòa Phát của HPG đến ngày 31/12/2023 là bao nhiêu %?",
      answer="99,999%", alts=[["99.999"]],
      evidence="Danh sách công ty con: 'Công ty CP Gang thép Hòa Phát | 99,999% (31/12/2023) | 99,998% (1/1/2023)'"),
 dict(id=140, ticker="HPG", report="HPG_2019_consolidated.md",
      question="Giá trị tài sản tài chính chịu lãi suất cố định của Công ty Cổ phần Tập đoàn Hòa Phát (HPG) ở cuối năm 2019 là bao nhiêu triệu đồng?",
      answer="4.287.452 triệu đồng", alts=[["4287452"]],
      evidence="Rủi ro lãi suất: 'Công cụ tài chính lãi suất cố định > Tài sản tài chính | 4.287.452 (31/12/2019)'"),
 dict(id=209, ticker="HPG", report="HPG_2021_consolidated.md",
      question="Tổng số dư phải thu về cho vay dài hạn cuối năm 2021 của Công ty Cổ phần Tập đoàn Hòa Phát là bao nhiêu trăm tỷ đồng?",
      answer="1,18 trăm tỷ đồng (118.401.369.280 đồng)", alts=[["118401369280"], ["1.18"], ["1.184"], ["118.4"]],
      evidence="Thuyết minh 11: tổng 118.401.369.280 (31/12/2021)"),
]

out = Path(__file__).with_name("gold_v1.jsonl")
with out.open("w", encoding="utf-8") as f:
    for g in G:
        row = {"id": g["id"], "ticker": g["ticker"], "question": g["question"], "gold_answer": g["answer"],
               "gold_alternatives": g["alts"], "required_reports": g["report"].split("|"), "evidence": g["evidence"],
               "source": "ViFinQA questions.jsonl; answers hand-verified from OCR text"}
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
print("wrote", out, len(G), "items")
