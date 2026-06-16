#!/bin/bash
# SkillX DMG Build Script
# Prerequisites: Rust, Node.js, npm

set -e

echo "🔨 Building SkillX DMG..."

# Check prerequisites
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Install from https://rustup.rs"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

echo "✅ Prerequisites found"
echo "   Rust: $(rustc --version)"
echo "   Node: $(node --version)"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Build the Tauri app (creates DMG)
echo "📀 Building DMG..."
npx tauri build

echo ""
echo "✅ Build complete!"
echo "   DMG location: src-tauri/target/release/bundle/dmg/"
echo ""
echo "To create a GitHub Release:"
echo "   1. Go to https://github.com/ZLHAOOO/SkillX/releases"
echo "   2. Click 'Create a new release'"
echo "   3. Tag it with the version (e.g. v2.1.0)"
echo "   4. Upload the DMG file from src-tauri/target/release/bundle/dmg/"
echo "   5. Publish the release"
