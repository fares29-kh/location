# syntax=docker/dockerfile:1.7
# PostgreSQL 16 + WAL-G. Le binaire Ubuntu 22.04 est lié à glibc 2.35, compatible
# avec Debian Bookworm (l'image postgres:16). Le binaire 24.04 exige une glibc plus récente.

FROM postgres:16-bookworm

ARG WALG_VERSION=3.0.9
ADD https://github.com/wal-g/wal-g/releases/download/v${WALG_VERSION}/wal-g-pg-22.04-amd64.tar.gz /tmp/wal-g.tar.gz
RUN tar -xzf /tmp/wal-g.tar.gz -C /usr/local/bin \
 && mv /usr/local/bin/wal-g-pg-22.04-amd64 /usr/local/bin/wal-g \
 && chmod 755 /usr/local/bin/wal-g \
 && rm /tmp/wal-g.tar.gz \
 && wal-g --version

# Azure signe blob.core.windows.net avec Microsoft TLS RSA Root G2.
# Debian Bookworm ne l'a pas dans son magasin Mozilla : wal-g refuse alors le TLS.
COPY deploy/postgres/certs/microsoft-tls-rsa-root-g2.crt /usr/local/share/ca-certificates/microsoft-tls-rsa-root-g2.crt
RUN openssl x509 -in /usr/local/share/ca-certificates/microsoft-tls-rsa-root-g2.crt -noout -fingerprint -sha256 \
      | tr -d ':' | grep -qi '6A170583DB584151E1C454EECA2A64CC5D8E484A5BD1156E720B4458654EE9E5' \
 && update-ca-certificates

COPY deploy/postgres/entrypoint.sh /usr/local/bin/drivetn-entrypoint.sh
RUN chmod 755 /usr/local/bin/drivetn-entrypoint.sh

ENTRYPOINT ["drivetn-entrypoint.sh"]
CMD ["postgres"]
