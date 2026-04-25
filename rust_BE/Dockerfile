# Build stage
FROM rust:1.85-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Keep the remote builder memory footprint low enough for heavy crates like async-stripe.
ENV CARGO_BUILD_JOBS=1 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Resolve dependencies before copying source so Docker can cache this expensive step.
RUN mkdir src && printf 'fn main() {}\n' > src/main.rs
RUN cargo fetch --locked

# Copy source code
COPY src ./src

# Build application
RUN cargo build --release --locked

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
