# Build stage
FROM rust:1.88-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies separately from source code.
# This layer is only invalidated when Cargo.toml or Cargo.lock change.
# Keep the remote builder memory footprint low enough for heavy crates like async-stripe.
ENV CARGO_BUILD_JOBS=1 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Copy manifests
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && printf 'fn main() {}\n' > src/main.rs && \
    cargo fetch --locked && \
    cargo build --release --locked && \
    rm -rf src

# Now copy the real source and do an incremental build
COPY src ./src
RUN touch src/main.rs && cargo build --release --locked

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
