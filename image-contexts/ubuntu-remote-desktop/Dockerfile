FROM scottyhardy/docker-remote-desktop:latest

USER root

COPY startwm.sh /etc/xrdp/startwm.sh
COPY xsession /etc/skel/.xsession
RUN chmod 0755 /etc/xrdp/startwm.sh \
    && chmod 0755 /etc/skel/.xsession
