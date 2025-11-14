+++
title = "Hi, I'm Gonzague 👋"
date = 2025-11-10T02:49:30+01:00
description = "A short introduction about who I am, what I do, and what drives me."
tags = ["DevOps", "Engineering", "Career", "Personal"]
draft = false
+++

<style>
.snowflake {
  position: fixed;
  top: -10px;
  z-index: 9999;
  user-select: none;
  cursor: default;
  animation-name: snowfall;
  animation-duration: 10s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  color: #fff;
  font-size: 1em;
  opacity: 0.8;
}

@keyframes snowfall {
  0% {
    transform: translateY(0vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0.3;
  }
}
</style>

<script>
(function() {
  const snowflakes = ['❄', '❅', '❆'];
  const numFlakes = 30;
  
  function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.className = 'snowflake';
    snowflake.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
    snowflake.style.left = Math.random() * 100 + '%';
    snowflake.style.animationDuration = (Math.random() * 5 + 8) + 's';
    snowflake.style.animationDelay = Math.random() * 5 + 's';
    snowflake.style.fontSize = (Math.random() * 0.8 + 0.8) + 'em';
    document.body.appendChild(snowflake);
    
    setTimeout(() => {
      snowflake.remove();
      createSnowflake();
    }, (parseFloat(snowflake.style.animationDuration) + parseFloat(snowflake.style.animationDelay)) * 1000);
  }
  
  window.addEventListener('load', function() {
    for (let i = 0; i < numFlakes; i++) {
      setTimeout(() => createSnowflake(), i * 300);
    }
  });
})();
</script>

## 👋 About Me

Hey there — I’m **Gonzague**, a **DevOps engineer** currently based in **Switzerland**.  
I’m passionate about **automation, reliability, and continuous improvement** in software systems. Over the past few years, I’ve worked across both **infrastructure** and **software development**, bridging the gap between development teams and operations to build scalable, secure, and efficient environments.

I enjoy solving complex problems, optimizing workflows, and helping teams deliver faster and more confidently. My background in development and IT infrastructure gives me a strong technical foundation, while my focus on **collaboration and empathy** helps create a positive and productive work environment.

## 💡 What I Value

- **Resilience and reliability** — in both systems and people.  
- **Knowledge sharing** — helping others grow makes the team stronger.  
- **Balance** — good engineering isn’t just technical; it’s human.  

I’m especially motivated by environments where technology serves a **long-term vision**, not just short-term goals. That’s why I’m drawn to stable, high-quality organizations where craftsmanship and resilience truly matter.

## 🛠️ A Few Things I Work With

- **Infrastructure:** Kubernetes, Docker, Terraform, Helm  
- **CI/CD:** ArgoCD, GitLab CI, Jenkins  
- **Cloud:** GCP, AWS, and on-prem clusters  
- **Languages:** Python, Go, Bash  

## 🐾 Outside of Work

When I’m not tuning clusters or optimizing pipelines, you’ll probably find me outdoors — walking my **White Swiss Shepherd** Utah, exploring nature, or taking time to reflect and recharge.  

I believe good ideas come from balance; between pressure and perspective.

## 🔗 Connect With Me

I'm always happy to connect with like-minded engineers, teams, and curious minds.  
You can find me on [**LinkedIn**](https://www.linkedin.com/in/gonzague-pagin) — feel free to reach out!

## 📄 Resume

Want to know more about my professional background? Check out my [**resume**](/resume/) or [download the PDF version](/cv-gp-2025-en.pdf).
