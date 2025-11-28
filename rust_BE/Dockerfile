# Build stage
FROM rust:1.83-slim as builder

WORKDIR /app

# Install nightly toolchain for edition2024 support
RUN rustup toolchain install nightly && \
    rustup default nightly

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary
COPY --from=builder /app/target/release/rust_BE /app/rust_BE

# Expose port
EXPOSE 3000

# Run the binary
CMD ["/app/rust_BE"]
