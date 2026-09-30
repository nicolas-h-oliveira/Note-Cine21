#!/usr/bin/env bash
# Verification Checklist for Note Cine Improvements
# Execute this to verify all files are in place

echo "=========================================="
echo "Note Cine — Verification Checklist"
echo "=========================================="
echo ""

# Check for new files
echo "✓ Checking NEW FILES..."
test -f "js/theme.js" && echo "  ✅ js/theme.js exists" || echo "  ❌ js/theme.js MISSING"
test -f "TESTING_SUITE.md" && echo "  ✅ TESTING_SUITE.md exists" || echo "  ❌ TESTING_SUITE.md MISSING"
test -f "PROJETO_FINAL_RELATORIO.md" && echo "  ✅ PROJETO_FINAL_RELATORIO.md exists" || echo "  ❌ PROJETO_FINAL_RELATORIO.md MISSING"
test -f "QUICK_REFERENCE.md" && echo "  ✅ QUICK_REFERENCE.md exists" || echo "  ❌ QUICK_REFERENCE.md MISSING"

echo ""
echo "✓ Checking MODIFIED FILES..."

# Check for key modifications in api.php
grep -q "function normalizeMovieId" api.php && echo "  ✅ api.php has normalizeMovieId()" || echo "  ❌ api.php missing normalizeMovieId()"
grep -q "function parseMovieId" api.php && echo "  ✅ api.php has parseMovieId()" || echo "  ❌ api.php missing parseMovieId()"

# Check for theme.js in HTML files
grep -q "js/theme.js" index.html && echo "  ✅ index.html includes theme.js" || echo "  ❌ index.html missing theme.js"
grep -q "js/theme.js" filme.html && echo "  ✅ filme.html includes theme.js" || echo "  ❌ filme.html missing theme.js"
grep -q "js/theme.js" perfil.html && echo "  ✅ perfil.html includes theme.js" || echo "  ❌ perfil.html missing theme.js"
grep -q "js/theme.js" favoritos.html && echo "  ✅ favoritos.html includes theme.js" || echo "  ❌ favoritos.html missing theme.js"

# Check for theme toggle button
grep -q "theme-toggle-btn" index.html && echo "  ✅ index.html has theme toggle" || echo "  ❌ index.html missing toggle"
grep -q "theme-toggle-btn" filme.html && echo "  ✅ filme.html has theme toggle" || echo "  ❌ filme.html missing toggle"
grep -q "theme-toggle-btn" perfil.html && echo "  ✅ perfil.html has theme toggle" || echo "  ❌ perfil.html missing toggle"
grep -q "theme-toggle-btn" favoritos.html && echo "  ✅ favoritos.html has theme toggle" || echo "  ❌ favoritos.html missing toggle"

echo ""
echo "✓ Checking CONTENT..."

# Check for categorized carousels in app.js
grep -q "Filmes" js/app.js && echo "  ✅ app.js has Filmes category" || echo "  ❌ app.js missing Filmes"
grep -q "Séries" js/app.js && echo "  ✅ app.js has Séries category" || echo "  ❌ app.js missing Séries"
grep -q "Animes" js/app.js && echo "  ✅ app.js has Animes category" || echo "  ❌ app.js missing Animes"

# Check for user search in search.js
grep -q "search_users" js/search.js && echo "  ✅ search.js has user search" || echo "  ❌ search.js missing user search"
grep -q "search-user-item" js/search.js && echo "  ✅ search.js has user UI" || echo "  ❌ search.js missing user UI"

# Check for theme CSS
grep -q "theme-toggle-btn" theme.css && echo "  ✅ theme.css has toggle styles" || echo "  ❌ theme.css missing toggle styles"
grep -q "search-section" theme.css && echo "  ✅ theme.css has search sections" || echo "  ❌ theme.css missing search sections"

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Review QUICK_REFERENCE.md for overview"
echo "2. Read TESTING_SUITE.md for test cases"
echo "3. Follow tests and mark results"
echo "4. Review PROJETO_FINAL_RELATORIO.md for details"
echo ""
