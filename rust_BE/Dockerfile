# Stage 1: install cargo-chef once (cached as long as Rust version doesn't change)
FROM rust:1.88-slim AS chef
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --locked
WORKDIR /app

# Stage 2: compute the dependency recipe from the manifests
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: build dependencies only (layer is cached until Cargo.lock changes)
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --locked

# Stage 4: minimal runtime image
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/rust_BE /app/rust_BE
EXPOSE 3000
CMD ["/app/rust_BE"]
