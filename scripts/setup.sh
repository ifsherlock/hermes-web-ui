#!/usr/bin/env bash
# hermes-web-ui environment check & auto-setup
# Usage: bash setup.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()   { echo -e "${RED}  ✗${NC} $1"; }

install_node_deb() {
    echo ""
    warn "Node.js is not installed, installing via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
    sudo apt install -y nodejs >/dev/null 2>&1
    info "Node.js $(node -v) installed"
}

install_node_mac() {
    echo ""
    warn "Node.js is not installed, installing via Homebrew..."
    if ! command -v brew &>/dev/null; then
        warn "Homebrew not found, installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install node
    info "Node.js $(node -v) installed"
}

check_node() {
    if command -v node &>/dev/null; then
        info "Node.js $(node -v) found ($(which node))"
        return 0
    fi

    # Auto-install based on OS
    if grep -qi microsoft /proc/version 2>/dev/null; then
        # WSL
        install_node_deb
    elif command -v apt &>/dev/null; then
        # Debian/Ubuntu
        install_node_deb
    elif command -v brew &>/dev/null || [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        install_node_mac
    else
        err "Node.js is not installed and auto-install is not supported on this system"
        echo "    Install manually: https://nodejs.org/"
        return 1
    fi
}

check_npm() {
    if command -v npm &>/dev/null; then
        info "npm $(npm -v) found"
        return 0
    fi
    err "npm is not installed (comes with Node.js)"
    return 1
}

check_hermes() {
    if command -v hermes &>/dev/null; then
        info "Hermes Agent found: $(hermes --version 2>/dev/null | head -1)"
        return 0
    fi
    warn "Hermes Agent CLI not found"
    echo "    Install it from: https://github.com/EKKOLearnAI/hermes-agent"
    return 1
}

check_port() {
    if command -v lsof &>/dev/null; then
        if lsof -i :8648 -t &>/dev/null; then
            warn "Port 8648 is already in use"
        else
            info "Port 8648 is available"
        fi
    fi
}

echo ""
echo "  hermes-web-ui — Environment Setup"
echo "  =================================="
echo ""

has_error=0

check_node   || has_error=1
echo ""
check_npm    || has_error=1
echo ""
check_hermes || has_error=1
echo ""
check_port

echo ""
if [ $has_error -eq 0 ]; then
    info "All checks passed! Run: hermes-web-ui start"
else
    warn "Some checks failed. Please fix the issues above."
fi
echo ""
