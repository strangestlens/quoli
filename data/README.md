# Word sources

`enable.txt` is ENABLE (Enhanced North American Benchmark Lexicon), 172,823
words, public domain. It is the only widely used list that is actually free to
redistribute — TWL is Hasbro's and Collins/SOWPODS is Collins', both licensed.

**Swapping it is a one-file change.** The browser never receives a dictionary;
it asks `/api/words` for the handful of words its twelve letters can form and
gets ~250 back. Replace `enable.txt`, rebuild, deploy. No client change, no API
change, no format change.

`allowlist.txt` is ours, merged on top. It survives a swap of the source list,
so words added here are not lost if the base changes. ENABLE was compiled in
the 1990s and misses a lot: no `email`, no `blog`, no `emoji`.
