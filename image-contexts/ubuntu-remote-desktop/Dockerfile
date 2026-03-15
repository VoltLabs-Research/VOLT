FROM scottyhardy/docker-remote-desktop:latest

USER root

RUN cp /usr/bin/entrypoint /usr/local/bin/upstream-entrypoint

COPY entrypoint.sh /usr/bin/entrypoint
COPY startwm.sh /etc/xrdp/startwm.sh
COPY xsession /etc/skel/.xsession
RUN chmod 0755 /usr/bin/entrypoint \
    && chmod 0755 /usr/local/bin/upstream-entrypoint \
    && chmod 0755 /etc/xrdp/startwm.sh \
    && chmod 0755 /etc/skel/.xsession
