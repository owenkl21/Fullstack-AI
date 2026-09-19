import re, sys
s = open(sys.argv[1]).read()
frame = s[s.index("</figcaption>")+len("</figcaption>"):]
frame = re.sub(r"<svg.*?</svg>", "<svg…/>", frame, flags=re.S)
frame = re.sub(r"><", ">\n<", frame)
# drop the header chrome (app header) which is the same everywhere
frame = re.sub(r'<div style="height:60px;background:#0B0909.*?</div>\n</div>\n<div style="height:2px;background:#34ADBD">\n</div>', '<APP HEADER + 2px teal rule>', frame, count=1, flags=re.S)
print(frame)
